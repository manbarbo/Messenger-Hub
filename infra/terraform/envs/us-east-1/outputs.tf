output "vpc_id" {
  value = module.networking.vpc_id
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
}

output "alb_dns_name" {
  value = try(module.ecs.alb_dns_name, null)
}

output "cloudfront_domain_name" {
  value = module.frontend.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}

output "web_bucket_id" {
  value = module.frontend.web_bucket_id
}

output "rds_endpoint" {
  value = module.data.db_endpoint
}

output "rds_instance_id" {
  value = module.data.db_instance_id
}

output "sqs_queue_url" {
  value = module.queue.queue_url
}

output "sqs_queue_arn" {
  value = module.queue.queue_arn
}

output "dlq_url" {
  value = module.queue.dlq_url
}

output "dlq_arn" {
  value = module.queue.dlq_arn
}

output "ecr_api_url" {
  value = module.ecr.ecr_api_url
}

output "ecr_worker_url" {
  value = module.ecr.ecr_worker_url
}

output "secret_llm_arn" {
  value = module.secrets.secret_llm_arn
}

output "secret_db_arn" {
  value = module.secrets.secret_db_arn
}

output "secret_mongo_arn" {
  value = module.secrets.secret_mongo_arn
}

output "secret_app_arn" {
  value = module.secrets.secret_app_arn
}

output "ecs_cluster_name" {
  value = try(module.ecs.cluster_name, null)
}

output "log_group_api" {
  value = module.observability.log_group_api_name
}

output "log_group_worker" {
  value = module.observability.log_group_worker_name
}

output "database_url" {
  value     = module.data.database_url
  sensitive = true
}
