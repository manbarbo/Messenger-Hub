resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.name_prefix}/api"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-logs-api"
  })
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name_prefix}/worker"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-logs-worker"
  })
}

resource "aws_cloudwatch_log_group" "alb" {
  name              = "/aws/alb/${var.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-logs-alb"
  })
}

resource "aws_cloudwatch_metric_alarm" "dlq_not_empty" {
  alarm_name          = "${var.name_prefix}-dlq-not-empty"
  alarm_description   = "Messages landed in the processing DLQ"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = element(split("/", var.dlq_arn), length(split("/", var.dlq_arn)) - 1)
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alarm-dlq"
  })
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count               = var.alb_arn_suffix == "" ? 0 : 1
  alarm_name          = "${var.name_prefix}-alb-5xx"
  alarm_description   = "ALB HTTP 5XX responses elevated"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alarm-alb-5xx"
  })
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count               = var.rds_instance_id == "" ? 0 : 1
  alarm_name          = "${var.name_prefix}-rds-cpu-high"
  alarm_description   = "RDS CPU utilization high"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 75
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alarm-rds-cpu"
  })
}
