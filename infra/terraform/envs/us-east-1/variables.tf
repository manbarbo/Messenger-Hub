variable "aws_region" {
  type        = string
  description = "Primary region"
  default     = "us-east-1"
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default = {
    Project = "MessengerHub"
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "allowed_https_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to ALB (restrict in production)"
  default     = ["0.0.0.0/0"]
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN in us-east-1 (empty = HTTP only)"
  default     = ""
}

variable "rds_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "rds_allocated_storage" {
  type    = number
  default = 100
}

variable "db_name" {
  type    = string
  default = "messenger_hub"
}

variable "db_username" {
  type    = string
  default = "messenger"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password — set via TF_VAR_db_password"
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "llm_api_key" {
  type        = string
  sensitive   = true
  description = "Gemini API key — set via TF_VAR_llm_api_key"
}

variable "llm_base_url" {
  type    = string
  default = "https://generativelanguage.googleapis.com/v1beta/openai/"
}

variable "llm_model" {
  type    = string
  default = "gemini-3.8-flash"
}

variable "embedding_model" {
  type    = string
  default = "gemini-embedding-001"
}

variable "embedding_dimensions" {
  type    = string
  default = "768"
}

variable "mongodb_uri" {
  type        = string
  sensitive   = true
  description = "MongoDB Atlas connection string — set via TF_VAR_mongodb_uri"
}

variable "default_clinic_id" {
  type    = string
  default = ""
}

variable "cors_origin" {
  type    = string
  default = "*"
}

variable "image_tag" {
  type        = string
  description = "Container image tag to deploy"
  default     = "latest"
}

variable "enable_ecs" {
  type    = bool
  default = true
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "worker_desired_count" {
  type    = number
  default = 2
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "enable_xray" {
  type    = bool
  default = true
}

variable "enable_s3_crr" {
  type        = bool
  description = "Enable S3 cross-region replication to sa-east-1"
  default     = false
}

variable "s3_crr_destination_bucket_arn" {
  type    = string
  default = ""
}

variable "s3_crr_role_arn" {
  type    = string
  default = ""
}

variable "cloudfront_price_class" {
  type    = string
  default = "PriceClass_100"
}
