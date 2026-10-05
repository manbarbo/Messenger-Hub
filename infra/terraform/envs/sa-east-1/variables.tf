variable "aws_region" {
  type        = string
  description = "Backup region"
  default     = "sa-east-1"
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default = {
    Project = "MessengerHub"
  }
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "Must match primary VPC CIDR if you plan VPC peering later"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "enable_nat_gateway" {
  type        = bool
  default     = false
  description = "Pilot-light: NAT off until failover is activated"
}

variable "allowed_https_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ACM cert in sa-east-1 (required only if ECS/ALB activated)"
}

variable "enable_ecs" {
  type        = bool
  default     = false
  description = "Pilot-light: keep ECS off until DR failover"
}

variable "enable_rds_standby" {
  type        = bool
  default     = false
  description = "Create a standby RDS instance (optional; default restore-from-snapshot)"
}

variable "enable_rds_multi_az" {
  type    = bool
  default = false
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
  type      = string
  sensitive = true
  default   = ""
}

variable "ecr_api_url" {
  type        = string
  default     = ""
  description = "Leave empty unless promoting ECS in sa-east-1 (use cross-region pull from us-east-1 ECR or copy image)"
}

variable "ecr_worker_url" {
  type    = string
  default = ""
}

variable "image_tag" {
  type    = string
  default = "latest"
}
