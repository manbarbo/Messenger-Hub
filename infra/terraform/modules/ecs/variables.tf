variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for ECS tasks"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnets for ALB"
}

variable "sg_alb_id" {
  type        = string
  description = "ALB security group"
}

variable "sg_api_id" {
  type        = string
  description = "API task security group"
}

variable "sg_worker_id" {
  type        = string
  description = "Worker task security group"
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS (empty = HTTP only)"
  default     = ""
}

variable "ecr_api_url" {
  type        = string
  description = "ECR API image URL"
}

variable "ecr_worker_url" {
  type        = string
  description = "ECR worker image URL"
}

variable "image_tag" {
  type        = string
  description = "Image tag to deploy"
  default     = "latest"
}

variable "queue_arn" {
  type        = string
  description = "Main SQS queue ARN"
}

variable "dlq_arn" {
  type        = string
  description = "DLQ ARN"
}

variable "secret_llm_arn" {
  type        = string
  description = "LLM secret ARN"
}

variable "secret_db_arn" {
  type        = string
  description = "DB secret ARN"
}

variable "secret_mongo_arn" {
  type        = string
  description = "Mongo secret ARN"
}

variable "secret_app_arn" {
  type        = string
  description = "App config secret ARN"
}

variable "log_group_api_arn" {
  type        = string
  description = "API CloudWatch log group ARN"
}

variable "log_group_worker_arn" {
  type        = string
  description = "Worker CloudWatch log group ARN"
}

variable "enable_xray" {
  type        = bool
  description = "Enable X-Ray on tasks"
  default     = true
}

variable "api_desired_count" {
  type        = number
  description = "API desired task count"
  default     = 2
}

variable "worker_desired_count" {
  type        = number
  description = "Worker desired task count"
  default     = 2
}

variable "api_cpu" {
  type        = number
  description = "API task CPU units (512 = 0.5 vCPU)"
  default     = 512
}

variable "api_memory" {
  type        = number
  description = "API task memory MB"
  default     = 1024
}

variable "worker_cpu" {
  type        = number
  description = "Worker task CPU units"
  default     = 512
}

variable "worker_memory" {
  type        = number
  description = "Worker task memory MB"
  default     = 1024
}

variable "app_port" {
  type        = number
  description = "API container port"
  default     = 3000
}

variable "enable_ecs" {
  type        = bool
  description = "Create ECS services (false for pilot-light DR)"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
