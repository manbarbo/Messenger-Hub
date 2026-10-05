variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for the DB subnet group"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups allowed to reach Postgres"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage in GB"
  default     = 100
}

variable "max_allocated_storage" {
  type        = number
  description = "Autoscaling max storage in GB"
  default     = 200
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ"
  default     = true
}

variable "db_name" {
  type        = string
  description = "Initial database name"
  default     = "messenger_hub"
}

variable "db_username" {
  type        = string
  description = "Master username"
  default     = "messenger"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Master password (set via TF_VAR_db_password or Secrets Manager later)"
}

variable "backup_retention_days" {
  type        = number
  description = "Automated backup retention"
  default     = 7
}

variable "deletion_protection" {
  type        = bool
  description = "Enable deletion protection"
  default     = true
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Skip final snapshot on destroy (false for prod)"
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
