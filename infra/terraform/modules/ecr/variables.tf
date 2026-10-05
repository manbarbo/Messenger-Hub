variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
