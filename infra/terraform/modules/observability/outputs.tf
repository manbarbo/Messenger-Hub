output "log_group_api_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "log_group_api_arn" {
  value = aws_cloudwatch_log_group.api.arn
}

output "log_group_worker_name" {
  value = aws_cloudwatch_log_group.worker.name
}

output "log_group_worker_arn" {
  value = aws_cloudwatch_log_group.worker.arn
}

output "log_group_alb_name" {
  value = aws_cloudwatch_log_group.alb.name
}

output "enable_xray" {
  value = var.enable_xray
}
