output "cluster_id" {
  value = try(aws_ecs_cluster.this[0].id, null)
}

output "cluster_name" {
  value = try(aws_ecs_cluster.this[0].name, null)
}

output "alb_dns_name" {
  value = try(aws_lb.this[0].dns_name, null)
}

output "alb_zone_id" {
  value = try(aws_lb.this[0].zone_id, null)
}

output "alb_arn" {
  value = try(aws_lb.this[0].arn, null)
}

output "alb_arn_suffix" {
  value = try(aws_lb.this[0].arn_suffix, null)
}

output "target_group_arn" {
  value = try(aws_lb_target_group.api[0].arn, null)
}

output "api_service_name" {
  value = try(aws_ecs_service.api[0].name, null)
}

output "worker_service_name" {
  value = try(aws_ecs_service.worker[0].name, null)
}

output "task_execution_role_arn" {
  value = try(aws_iam_role.execution[0].arn, null)
}

output "task_role_arn" {
  value = try(aws_iam_role.task[0].arn, null)
}

output "ecs_enabled" {
  value = local.enable
}
