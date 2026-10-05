# INFRA-1.1 — Terraform AWS Multi-Region + Dockerfiles

**Status:** Completed
**Date:** 2026-10-04
**Completed:** 2026-10-04
**Type:** Infrastructure as Code

**Verification result:** `terraform validate` succeeded for both `envs/us-east-1` and `envs/sa-east-1` (AWS provider v5.100.0). No `terraform apply` was executed.

---

## Objective

Create Terraform infrastructure for MessengerHub AWS production deployment:

- **Primary region `us-east-1`:** full stack (VPC, ECS Fargate API+Worker, RDS PostgreSQL 16 + pgvector Multi-AZ, SQS+DLQ, ALB, S3+CloudFront, Secrets Manager, ECR, observability).
- **Backup region `sa-east-1`:** pilot-light (mirrored VPC, S3 replication target, ECS disabled by default, DR runbook).
- **Dockerfiles** for API/worker images required by ECS.

No real `terraform apply` in this task — only IaC, validate, and docs.

---

## Decisions (user-confirmed)

| Topic | Decision |
|-------|----------|
| Document DB | MongoDB Atlas M10 — outside Terraform; TF leaves peering notes + outputs |
| sa-east-1 | Pilot-light (ECS off, no hot standby) |
| TLS | `certificate_arn` optional variable |
| Docker | Included (`apps/api/Dockerfile` multi-stage, API + worker CMDs) |

---

## Acceptance Criteria

- [x] Plan created under `plans/inProgress/` then completed
- [x] `infra/terraform/modules/*` + `envs/us-east-1` + `envs/sa-east-1`
- [x] us-east-1: VPC, SGs, ALB (optional cert), ECS API/Worker, RDS pg16 Multi-AZ, SQS+DLQ, S3+CloudFront, Secrets, ECR, logs/alarms
- [x] sa-east-1: VPC + S3 CRR target; ECS off; DR runbook in README
- [x] Atlas documented; no Atlas resource in TF
- [x] `apps/api/Dockerfile` + `.dockerignore`
- [x] `terraform fmt` + `terraform validate` pass for both envs
- [x] `certificate_arn` optional
- [x] No real secrets in git; tfvars example only
- [x] `infra/terraform/README.md` + `docs/aws-architecture.md` §11 updated
- [x] No real `terraform apply`

---

## Implementation Steps

1. Create Terraform modules under `infra/terraform/modules/`.
2. Wire `envs/us-east-1` (full) and `envs/sa-east-1` (pilot-light).
3. Create Dockerfile + .dockerignore for API/worker.
4. Format + validate Terraform.
5. Write README + update architecture doc gap map.
6. Move plan to `plans/completed/`.

---

## File Structure

```text
infra/terraform/
├── README.md
├── modules/
│   ├── networking/
│   ├── ecr/
│   ├── data/
│   ├── queue/
│   ├── secrets/
│   ├── observability/
│   ├── ecs/
│   └── frontend/
├── envs/
│   ├── us-east-1/
│   └── sa-east-1/

apps/api/Dockerfile
apps/api/.dockerignore
```

---

## Verification

```bash
terraform -chdir=infra/terraform/envs/us-east-1 fmt -check
terraform -chdir=infra/terraform/envs/us-east-1 init -backend=false
terraform -chdir=infra/terraform/envs/us-east-1 validate
terraform -chdir=infra/terraform/envs/sa-east-1 init -backend=false
terraform -chdir=infra/terraform/envs/sa-east-1 validate
test -f apps/api/Dockerfile
```

---

## References

- `docs/aws-architecture.md` — production design this IaC implements
- `DECISIONS.md` §7, §11, §12
- `AGENTS.md` — plan workflow, architecture boundaries
