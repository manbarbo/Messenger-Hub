resource "aws_secretsmanager_secret" "llm" {
  name                    = "${var.name_prefix}/llm"
  description             = "LLM (Gemini) credentials and model config"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-secret-llm"
  })
}

resource "aws_secretsmanager_secret_version" "llm" {
  secret_id = aws_secretsmanager_secret.llm.id
  secret_string = jsonencode({
    LLM_API_KEY          = var.llm_api_key
    LLM_BASE_URL         = var.llm_base_url
    LLM_MODEL            = var.llm_model
    EMBEDDING_MODEL      = var.embedding_model
    EMBEDDING_DIMENSIONS = var.embedding_dimensions
  })
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.name_prefix}/db"
  description             = "PostgreSQL connection string"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-secret-db"
  })
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = var.database_url
}

resource "aws_secretsmanager_secret" "mongo" {
  name                    = "${var.name_prefix}/mongo"
  description             = "MongoDB Atlas connection string"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-secret-mongo"
  })
}

resource "aws_secretsmanager_secret_version" "mongo" {
  secret_id     = aws_secretsmanager_secret.mongo.id
  secret_string = var.mongodb_uri
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}/app"
  description             = "Application runtime config"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-secret-app"
  })
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    NODE_ENV          = var.node_env
    CORS_ORIGIN       = var.cors_origin
    DEFAULT_CLINIC_ID = var.default_clinic_id
    PORT              = "3000"
    # Production uses SQS; disable BullBoard
    BULL_BOARD_ENABLED = "false"
  })
}
