output "ecr_api_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_worker_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "ecr_api_arn" {
  value = aws_ecr_repository.api.arn
}

output "ecr_worker_arn" {
  value = aws_ecr_repository.worker.arn
}
