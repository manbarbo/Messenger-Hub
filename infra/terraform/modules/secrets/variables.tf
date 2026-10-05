variable "name_prefix" {
  type        = string
  description = "Prefix for secret names"
}

variable "llm_api_key" {
  type        = string
  sensitive   = true
  description = "Gemini / LLM API key"
}

variable "llm_base_url" {
  type        = string
  description = "LLM OpenAI-compatible base URL"
  default     = "https://generativelanguage.googleapis.com/v1beta/openai/"
}

variable "llm_model" {
  type        = string
  description = "Chat model name"
  default     = "gemini-3.8-flash"
}

variable "embedding_model" {
  type        = string
  description = "Embedding model"
  default     = "gemini-embedding-001"
}

variable "embedding_dimensions" {
  type        = string
  description = "Embedding dimensions"
  default     = "768"
}

variable "database_url" {
  type        = string
  sensitive   = true
  description = "PostgreSQL connection string"
}

variable "mongodb_uri" {
  type        = string
  sensitive   = true
  description = "MongoDB Atlas connection string"
}

variable "default_clinic_id" {
  type        = string
  description = "Default clinic UUID for webhook fallback"
  default     = ""
}

variable "cors_origin" {
  type        = string
  description = "CORS origin for dashboard"
  default     = "*"
}

variable "node_env" {
  type        = string
  description = "NODE_ENV"
  default     = "production"
}

variable "tags" {
  type        = map(string)
  description = "Common tags"
  default     = {}
}
