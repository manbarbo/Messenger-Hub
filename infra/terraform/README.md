# MessengerHub — Terraform AWS Infrastructure

Infrastructure as code for the production architecture described in
[`docs/aws-architecture.md`](../../docs/aws-architecture.md).

| Environment | Region | Role |
|-------------|--------|------|
| `envs/us-east-1` | **us-east-1** | Primary production stack |
| `envs/sa-east-1` | **sa-east-1** | Pilot-light DR (ECS off by default) |

> **This repo does not auto-deploy.** Run `terraform apply` manually with AWS credentials. No backend is configured yet — add an S3 backend before sharing state.

---

## What is provisioned (us-east-1)

| Module | Resources |
|--------|-----------|
| `networking` | VPC 2 AZs, public/private subnets, IGW, 1 NAT, SGs (alb/api/worker/rds) |
| `ecr` | `*-api`, `*-worker` repositories |
| `data` | RDS PostgreSQL 16 Multi-AZ, gp3 100GB, encrypted, parameter group |
| `queue` | SQS `message-processing` + DLQ (`maxReceiveCount=3`, 14-day retention) |
| `secrets` | Secrets Manager: `/llm`, `/db`, `/mongo`, `/app` |
| `ecs` | Fargate cluster, ALB, API + Worker services, autoscaling, IAM |
| `frontend` | S3 static site + CloudFront (`/api/*`, `/webhooks/*` → ALB) |
| `observability` | Log groups (30d), DLQ / ALB 5xx / RDS CPU alarms |

**Not in Terraform:** MongoDB Atlas cluster (create in Atlas UI; paste connection string into `TF_VAR_mongodb_uri`). TLS cert: optional `certificate_arn` in **us-east-1** (CloudFront ACM must be in us-east-1).

## sa-east-1 (pilot-light)

- Mirrored VPC (same CIDRs)
- DR S3 bucket + IAM role for **CRR** from primary
- **ECS disabled** (`enable_ecs = false`)
- **RDS standby disabled** (restore from primary snapshots on failover)
- Optional NAT / RDS via variables when activating DR

---

## Prerequisites

1. Terraform >= 1.5
2. AWS credentials (`aws configure` or environment)
3. MongoDB Atlas M10 (or any Mongo URI)
4. Gemini API key
5. (Optional) ACM certificate in us-east-1

---

## Quick start (us-east-1)

```bash
cd infra/terraform/envs/us-east-1

cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — or export secrets as env vars:

export TF_VAR_db_password='...'
export TF_VAR_llm_api_key='...'
export TF_VAR_mongodb_uri='mongodb+srv://...'
export TF_VAR_default_clinic_id='your-clinic-uuid'

terraform init
terraform plan
terraform apply
```

### Build & push images

```bash
# From monorepo root
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker build -f apps/api/Dockerfile -t messengerhub-api:latest .
TAG=$(date +%Y%m%d-%H%M%S)

docker tag messengerhub-api:latest <account>.dkr.ecr.us-east-1.amazonaws.com/messengerhub-prod-api:$TAG
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/messengerhub-prod-api:$TAG

# Worker uses the same image; ECS task command is node dist/worker-main.js
# Set var image_tag=$TAG and re-apply if needed
```

### Upload frontend

```bash
pnpm --filter web build
aws s3 sync apps/web/dist/web/browser/ s3://$(terraform output -raw web_bucket_id)/ --delete
```

### Database migrations

Run once (or from a one-off task) against the RDS endpoint:

```bash
cd apps/api
DATABASE_URL='postgres://...' npx prisma migrate deploy
DATABASE_URL='postgres://...' npx tsx scripts/ensure-mongo-indexes.ts
```

---

## Variables that must never be committed

| Variable | How to set |
|----------|------------|
| `db_password` | `TF_VAR_db_password` |
| `llm_api_key` | `TF_VAR_llm_api_key` |
| `mongodb_uri` | `TF_VAR_mongodb_uri` |

`terraform.tfvars.example` contains placeholders only. Keep real `terraform.tfvars` out of git (add to `.gitignore` if needed).

---

## DR runbook (sa-east-1 pilot-light → failover)

1. **Promote snapshots:** restore latest RDS snapshot into sa-east-1 (or set `enable_rds_standby=true` and apply).
2. **Secrets:** copy/recreate Secrets Manager values in sa-east-1 (or export/import).
3. **ECS:** set `enable_ecs=true`, point `ecr_*_url` at copied images (ECR is regional — replicate or pull-through), set `certificate_arn` if using HTTPS.
4. **NAT:** set `enable_nat_gateway=true` for private egress.
5. **DNS / CloudFront:** switch origin to sa-east-1 ALB or fail over CloudFront origin.
6. **Atlas:** promote Atlas secondary / update connection string in secrets.
7. **Webhooks:** point WhatsApp webhook URL to new ALB/CloudFront domain.

---

## Cost estimate

See [`docs/aws-architecture.md` §9](../../docs/aws-architecture.md):

- Primary (~us-east-1): **~$320/mo** infra
- Pilot-light DR: **~$80–150/mo** extra (VPC + S3; ECS/RDS off)
- LLM: separate (~$180–400/mo)

---

## Module layout

```text
infra/terraform/
├── modules/
│   ├── networking/     VPC, subnets, SGs
│   ├── ecr/            Container repositories
│   ├── data/           RDS PostgreSQL + pgvector notes
│   ├── queue/          SQS + DLQ
│   ├── secrets/        Secrets Manager
│   ├── observability/  Logs + alarms
│   ├── ecs/            ALB + Fargate API/Worker + autoscaling
│   └── frontend/       S3 + CloudFront (+ optional CRR)
└── envs/
    ├── us-east-1/      Primary
    └── sa-east-1/      Pilot-light DR
```

---

## Known gaps (application, not Terraform)

Per `docs/aws-architecture.md` §11:

- **SQS adapter** — app still uses BullMQ locally; production worker needs `SqsQueueService`
- **Auth / RLS** — multi-tenant enforcement not in application code yet
- **Prisma migrate deploy** — no package script; run manually or add CI

---

## Validation

```bash
terraform -chdir=infra/terraform/envs/us-east-1 fmt -check
terraform -chdir=infra/terraform/envs/us-east-1 init -backend=false
terraform -chdir=infra/terraform/envs/us-east-1 validate

terraform -chdir=infra/terraform/envs/sa-east-1 init -backend=false
terraform -chdir=infra/terraform/envs/sa-east-1 validate
```
