variable "name_prefix" {
  type        = string
  description = "Prefix for resource names (e.g. messengerhub-prod)"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs (one per AZ)"
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs (one per AZ)"
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Create a NAT Gateway for private-subnet egress"
  default     = true
}

variable "allowed_https_cidrs" {
  type        = list(string)
  description = "CIDR blocks allowed to reach the ALB on 443/80"
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
