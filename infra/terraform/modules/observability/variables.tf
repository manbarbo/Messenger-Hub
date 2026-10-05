variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch Logs retention"
  default     = 30
}

variable "dlq_arn" {
  type        = string
  description = "DLQ ARN for alarm"
}

variable "alb_arn_suffix" {
  type        = string
  description = "ALB ARN suffix for metrics (optional)"
  default     = ""
}

variable "rds_instance_id" {
  type        = string
  description = "RDS instance id for CPU alarm (optional)"
  default     = ""
}

variable "enable_xray" {
  type        = bool
  description = "Enable X-Ray tracing on services"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
