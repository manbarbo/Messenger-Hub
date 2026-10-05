variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "queue_name" {
  type        = string
  description = "Main processing queue name"
  default     = "message-processing"
}

variable "dlq_name" {
  type        = string
  description = "Dead letter queue name"
  default     = "message-processing-dlq"
}

variable "max_receive_count" {
  type        = number
  description = "Max receives before DLQ"
  default     = 3
}

variable "message_retention_seconds" {
  type        = number
  description = "Message retention (14 days)"
  default     = 1209600
}

variable "visibility_timeout_seconds" {
  type        = number
  description = "Visibility timeout (LLM can take 30s+; keep generous)"
  default     = 300
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
