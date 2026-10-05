terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Configure remote state (e.g. S3 + DynamoDB) before production apply:
  # backend "s3" {
  #   bucket         = "messengerhub-tfstate"
  #   key            = "us-east-1/terraform.tfstate"
  #   region         = "us-east-1"
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
  name_prefix = "messengerhub-prod"

  tags = merge(var.tags, {
    Project     = "MessengerHub"
    Environment = "production"
    Region      = "primary"
  })
}

# --- Networking ---

module "networking" {
  source = "../../modules/networking"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_nat_gateway   = true
  allowed_https_cidrs  = var.allowed_https_cidrs
  tags                 = local.tags
}

# --- ECR ---

module "ecr" {
  source = "../../modules/ecr"

  name_prefix = local.name_prefix
  tags        = local.tags
}

# --- RDS PostgreSQL + pgvector ---

module "data" {
  source = "../../modules/data"

  name_prefix         = local.name_prefix
  private_subnet_ids  = module.networking.private_subnet_ids
  security_group_ids  = [module.networking.sg_rds_id]
  instance_class      = var.rds_instance_class
  allocated_storage   = var.rds_allocated_storage
  multi_az            = true
  db_name             = var.db_name
  db_username         = var.db_username
  db_password         = var.db_password
  deletion_protection = var.deletion_protection
  skip_final_snapshot = false
  tags                = local.tags
}

# --- SQS + DLQ ---

module "queue" {
  source = "../../modules/queue"

  name_prefix = local.name_prefix
  tags        = local.tags
}

# --- Secrets Manager ---

module "secrets" {
  source = "../../modules/secrets"

  name_prefix          = local.name_prefix
  llm_api_key          = var.llm_api_key
  llm_base_url         = var.llm_base_url
  llm_model            = var.llm_model
  embedding_model      = var.embedding_model
  embedding_dimensions = var.embedding_dimensions
  database_url         = module.data.database_url
  mongodb_uri          = var.mongodb_uri
  default_clinic_id    = var.default_clinic_id
  cors_origin          = var.cors_origin
  node_env             = "production"
  tags                 = local.tags
}

# --- Observability ---

module "observability" {
  source = "../../modules/observability"

  name_prefix        = local.name_prefix
  log_retention_days = var.log_retention_days
  dlq_arn            = module.queue.dlq_arn
  alb_arn_suffix     = try(module.ecs.alb_arn_suffix, "")
  rds_instance_id    = module.data.db_instance_id
  enable_xray        = var.enable_xray
  tags               = local.tags
}

# --- ECS + ALB ---

module "ecs" {
  source = "../../modules/ecs"

  name_prefix          = local.name_prefix
  vpc_id               = module.networking.vpc_id
  private_subnet_ids   = module.networking.private_subnet_ids
  public_subnet_ids    = module.networking.public_subnet_ids
  sg_alb_id            = module.networking.sg_alb_id
  sg_api_id            = module.networking.sg_api_id
  sg_worker_id         = module.networking.sg_worker_id
  certificate_arn      = var.certificate_arn
  ecr_api_url          = module.ecr.ecr_api_url
  ecr_worker_url       = module.ecr.ecr_worker_url
  image_tag            = var.image_tag
  queue_arn            = module.queue.queue_arn
  dlq_arn              = module.queue.dlq_arn
  secret_llm_arn       = module.secrets.secret_llm_arn
  secret_db_arn        = module.secrets.secret_db_arn
  secret_mongo_arn     = module.secrets.secret_mongo_arn
  secret_app_arn       = module.secrets.secret_app_arn
  log_group_api_arn    = module.observability.log_group_api_arn
  log_group_worker_arn = module.observability.log_group_worker_arn
  enable_xray          = var.enable_xray
  api_desired_count    = var.api_desired_count
  worker_desired_count = var.worker_desired_count
  enable_ecs           = var.enable_ecs
  tags                 = local.tags
}

# --- Frontend: S3 + CloudFront ---

module "frontend" {
  source = "../../modules/frontend"

  name_prefix                = local.name_prefix
  alb_dns_name               = try(module.ecs.alb_dns_name, "")
  alb_zone_id                = try(module.ecs.alb_zone_id, "")
  enable_crr                 = var.enable_s3_crr
  crr_destination_bucket_arn = var.s3_crr_destination_bucket_arn
  crr_role_arn               = var.s3_crr_role_arn
  price_class                = var.cloudfront_price_class
  tags                       = local.tags
}
