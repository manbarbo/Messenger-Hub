output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = local.public_subnet_ids
}

output "private_subnet_ids" {
  value = local.private_subnet_ids
}

output "nat_gateway_id" {
  value = try(aws_nat_gateway.this[0].id, null)
}

output "sg_alb_id" {
  value = aws_security_group.alb.id
}

output "sg_api_id" {
  value = aws_security_group.api.id
}

output "sg_worker_id" {
  value = aws_security_group.worker.id
}

output "sg_rds_id" {
  value = aws_security_group.rds.id
}
