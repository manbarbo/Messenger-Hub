output "vpc_id" {
  value = module.networking.vpc_id
}

output "web_dr_bucket_id" {
  value = aws_s3_bucket.web_dr.id
}

output "web_dr_bucket_arn" {
  value = aws_s3_bucket.web_dr.arn
}

output "s3_crr_role_arn" {
  value = aws_iam_role.s3_crr.arn
}

output "ecs_enabled" {
  value = var.enable_ecs
}

output "rds_enabled" {
  value = var.enable_rds_standby
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "alb_dns_name" {
  value = try(module.ecs.alb_dns_name, null)
}
