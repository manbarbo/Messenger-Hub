terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # backend "s3" {
  #   bucket         = "messengerhub-tfstate"
  #   key            = "sa-east-1/terraform.tfstate"
  #   region         = "us-east-1"   # state bucket lives in primary region
  #   dynamodb_table = "messengerhub-tf-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

locals {
  name_prefix = "messengerhub-dr"

  tags = merge(var.tags, {
    Project     = "MessengerHub"
    Environment = "production-dr"
    Region      = "backup"
  })
}

# --- Networking (mirrored VPC for pilot-light DR) ---

module "networking" {
  source = "../../modules/networking"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_nat_gateway   = var.enable_nat_gateway
  allowed_https_cidrs  = var.allowed_https_cidrs
  tags                 = local.tags
}

# --- DR static web bucket (CRR destination from us-east-1) ---

resource "aws_s3_bucket" "web_dr" {
  bucket_prefix = "${local.name_prefix}-web-"
  force_destroy = false

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-web"
    Role = "dr-static-target"
  })
}

resource "aws_s3_bucket_versioning" "web_dr" {
  bucket = aws_s3_bucket.web_dr.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web_dr" {
  bucket = aws_s3_bucket.web_dr.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "web_dr" {
  bucket = aws_s3_bucket.web_dr.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- IAM role for S3 CRR (us-east-1 → this bucket) ---

resource "aws_iam_role" "s3_crr" {
  name = "${local.name_prefix}-s3-crr"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "s3_crr" {
  name = "${local.name_prefix}-s3-crr"
  role = aws_iam_role.s3_crr.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket",
        ]
        Resource = "arn:aws:s3:::*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
        ]
        Resource = "arn:aws:s3:::*/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags",
        ]
        Resource = "arn:aws:s3:::*/*"
      },
    ]
  })
}

# --- ECS: DISABLED by default (pilot-light) ---

module "ecs" {
  source = "../../modules/ecs"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  sg_alb_id          = module.networking.sg_alb_id
  sg_api_id          = module.networking.sg_api_id
  sg_worker_id       = module.networking.sg_worker_id
  certificate_arn    = var.certificate_arn
  # Placeholder image URLs — real ECR lives in us-east-1
  ecr_api_url          = var.ecr_api_url
  ecr_worker_url       = var.ecr_worker_url
  image_tag            = var.image_tag
  queue_arn            = "arn:aws:sqs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${local.name_prefix}-message-processing"
  dlq_arn              = "arn:aws:sqs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${local.name_prefix}-message-processing-dlq"
  secret_llm_arn       = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${local.name_prefix}/llm"
  secret_db_arn        = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${local.name_prefix}/db"
  secret_mongo_arn     = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${local.name_prefix}/mongo"
  secret_app_arn       = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${local.name_prefix}/app"
  log_group_api_arn    = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}/api:*"
  log_group_worker_arn = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}/worker:*"
  enable_ecs           = var.enable_ecs
  enable_xray          = false
  tags                 = local.tags
}

data "aws_caller_identity" "current" {}

# --- Optional: RDS standby (disabled by default — restore from primary snapshots) ---

module "data" {
  source = "../../modules/data"
  count  = var.enable_rds_standby ? 1 : 0

  name_prefix         = local.name_prefix
  private_subnet_ids  = module.networking.private_subnet_ids
  security_group_ids  = [module.networking.sg_rds_id]
  instance_class      = var.rds_instance_class
  allocated_storage   = var.rds_allocated_storage
  multi_az            = var.enable_rds_multi_az
  db_name             = var.db_name
  db_username         = var.db_username
  db_password         = var.db_password
  deletion_protection = false
  skip_final_snapshot = true
  tags                = local.tags
}
