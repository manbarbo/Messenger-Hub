locals {
  enable = var.enable_ecs

  api_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = tostring(var.app_port) },
    { name = "BULL_BOARD_ENABLED", value = "false" },
  ]

  secret_env = [
    { valueFrom = "${var.secret_llm_arn}:LLM_API_KEY::" },
    { valueFrom = "${var.secret_llm_arn}:LLM_BASE_URL::" },
    { valueFrom = "${var.secret_llm_arn}:LLM_MODEL::" },
    { valueFrom = "${var.secret_llm_arn}:EMBEDDING_MODEL::" },
    { valueFrom = "${var.secret_llm_arn}:EMBEDDING_DIMENSIONS::" },
    { valueFrom = "${var.secret_db_arn}:DATABASE_URL::" },
    { valueFrom = "${var.secret_mongo_arn}::" },
    { valueFrom = "${var.secret_app_arn}:CORS_ORIGIN::" },
    { valueFrom = "${var.secret_app_arn}:DEFAULT_CLINIC_ID::" },
    { valueFrom = "${var.secret_app_arn}:NODE_ENV::" },
  ]

  worker_secret_env = [
    { valueFrom = "${var.secret_llm_arn}:LLM_API_KEY::" },
    { valueFrom = "${var.secret_llm_arn}:LLM_BASE_URL::" },
    { valueFrom = "${var.secret_llm_arn}:LLM_MODEL::" },
    { valueFrom = "${var.secret_llm_arn}:EMBEDDING_MODEL::" },
    { valueFrom = "${var.secret_llm_arn}:EMBEDDING_DIMENSIONS::" },
    { valueFrom = "${var.secret_db_arn}:DATABASE_URL::" },
    { valueFrom = "${var.secret_mongo_arn}::" },
    { valueFrom = "${var.secret_app_arn}:NODE_ENV::" },
  ]

  worker_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "BULL_BOARD_ENABLED", value = "false" },
  ]
}

# --- Cluster ---

resource "aws_ecs_cluster" "this" {
  count = local.enable ? 1 : 0
  name  = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-cluster"
  })
}

# --- IAM: task execution + task roles ---

resource "aws_iam_role" "execution" {
  count = local.enable ? 1 : 0
  name  = "${var.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  count      = local.enable ? 1 : 0
  role       = aws_iam_role.execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  count = local.enable ? 1 : 0
  name  = "${var.name_prefix}-execution-secrets"
  role  = aws_iam_role.execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Resource = [
          var.secret_llm_arn,
          var.secret_db_arn,
          var.secret_mongo_arn,
          var.secret_app_arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role" "task" {
  count = local.enable ? 1 : 0
  name  = "${var.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "task" {
  count = local.enable ? 1 : 0
  name  = "${var.name_prefix}-task-sqs-logs"
  role  = aws_iam_role.task[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
        ]
        Resource = [var.queue_arn, var.dlq_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

# --- ALB ---

resource "aws_lb" "this" {
  count              = local.enable ? 1 : 0
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.sg_alb_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false
  drop_invalid_header_fields = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alb"
  })
}

resource "aws_lb_target_group" "api" {
  count       = local.enable ? 1 : 0
  name        = "${var.name_prefix}-api-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-tg"
  })
}

resource "aws_lb_listener" "http" {
  count             = local.enable ? 1 : 0
  load_balancer_arn = aws_lb.this[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.certificate_arn == "" ? "forward" : "redirect"

    dynamic "redirect" {
      for_each = var.certificate_arn == "" ? [] : [1]
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    dynamic "forward" {
      for_each = var.certificate_arn == "" ? [1] : []
      content {
        target_group {
          arn = aws_lb_target_group.api[0].arn
        }
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = local.enable && var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.this[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.api[0].arn
      }
    }
  }
}

# --- Task definitions ---

resource "aws_ecs_task_definition" "api" {
  count                    = local.enable ? 1 : 0
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution[0].arn
  task_role_arn            = aws_iam_role.task[0].arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${var.ecr_api_url}:${var.image_tag}"
      essential = true
      cpu       = var.api_cpu
      memory    = var.api_memory
      portMappings = [
        {
          containerPort = var.app_port
          hostPort      = var.app_port
          protocol      = "tcp"
        }
      ]
      environment = local.api_env
      secrets     = local.secret_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_api_arn
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "api"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.app_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 40
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-task-api"
  })
}

resource "aws_ecs_task_definition" "worker" {
  count                    = local.enable ? 1 : 0
  family                   = "${var.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution[0].arn
  task_role_arn            = aws_iam_role.task[0].arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${var.ecr_worker_url}:${var.image_tag}"
      essential = true
      cpu       = var.worker_cpu
      memory    = var.worker_memory
      # Worker must NOT bind HTTP (worker-main uses application context only)
      command     = ["node", "dist/worker-main.js"]
      environment = local.worker_env
      secrets     = local.worker_secret_env
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_worker_arn
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-task-worker"
  })
}

# --- Services ---

resource "aws_ecs_service" "api" {
  count           = local.enable ? 1 : 0
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.this[0].id
  task_definition = aws_ecs_task_definition.api[0].arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.sg_api_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api[0].arn
    container_name   = "api"
    container_port   = var.app_port
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60
  propagate_tags                     = "SERVICE"

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-svc-api"
  })
}

resource "aws_ecs_service" "worker" {
  count           = local.enable ? 1 : 0
  name            = "${var.name_prefix}-worker"
  cluster         = aws_ecs_cluster.this[0].id
  task_definition = aws_ecs_task_definition.worker[0].arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.sg_worker_id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  propagate_tags                     = "SERVICE"

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-svc-worker"
  })
}

# --- Autoscaling ---

resource "aws_appautoscaling_target" "api" {
  count              = local.enable ? 1 : 0
  max_capacity       = 4
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.this[0].name}/${aws_ecs_service.api[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  count              = local.enable ? 1 : 0
  name               = "${var.name_prefix}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "worker" {
  count              = local.enable ? 1 : 0
  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.this[0].name}/${aws_ecs_service.worker[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_sqs" {
  count              = local.enable ? 1 : 0
  name               = "${var.name_prefix}-worker-sqs"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker[0].resource_id
  scalable_dimension = aws_appautoscaling_target.worker[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "SQSQueueVisibleNumberOfMessages"
      resource_label         = var.queue_arn
    }
    target_value       = 100
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}

data "aws_region" "current" {}
