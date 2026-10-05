variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for ALB (if used) — currently unused for static-only mode"
  default     = []
}

variable "alb_dns_name" {
  type        = string
  description = "ALB DNS name for /api and /webhooks origin"
  default     = ""
}

variable "alb_zone_id" {
  type        = string
  description = "ALB hosted zone id"
  default     = ""
}

variable "enable_crr" {
  type        = bool
  description = "Enable cross-region replication to a secondary bucket"
  default     = false
}

variable "crr_destination_bucket_arn" {
  type        = string
  description = "Destination bucket ARN for CRR (sa-east-1)"
  default     = ""
}

variable "crr_role_arn" {
  type        = string
  description = "IAM role ARN for S3 CRR"
  default     = ""
}

variable "price_class" {
  type        = string
  description = "CloudFront price class"
  default     = "PriceClass_100"
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
