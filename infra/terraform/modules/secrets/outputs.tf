output "secret_llm_arn" {
  value = aws_secretsmanager_secret.llm.arn
}

output "secret_llm_name" {
  value = aws_secretsmanager_secret.llm.name
}

output "secret_db_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "secret_db_name" {
  value = aws_secretsmanager_secret.db.name
}

output "secret_mongo_arn" {
  value = aws_secretsmanager_secret.mongo.arn
}

output "secret_mongo_name" {
  value = aws_secretsmanager_secret.mongo.name
}

output "secret_app_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "secret_app_name" {
  value = aws_secretsmanager_secret.app.name
}
