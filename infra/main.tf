terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "container_image" {
  type        = string
  description = "ECR or registry image URI for the Potter Pulse container."
}

variable "execution_role_arn" {
  type        = string
  description = "Existing ECS task execution role ARN."
}

variable "task_role_arn" {
  type        = string
  description = "Existing ECS task role ARN."
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for the Fargate service."
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups that allow inbound traffic to port 4173."
}

provider "aws" {
  region = var.aws_region
}

resource "aws_cloudwatch_log_group" "potter_pulse" {
  name              = "/ecs/potter-pulse"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "potter_pulse" {
  name = "potter-pulse"
}

resource "aws_ecs_task_definition" "potter_pulse" {
  family                   = "potter-pulse"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "potter-pulse"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = 4173
          hostPort      = 4173
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PORT"
          value = "4173"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.potter_pulse.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "potter_pulse" {
  name            = "potter-pulse"
  cluster         = aws_ecs_cluster.potter_pulse.id
  task_definition = aws_ecs_task_definition.potter_pulse.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }
}
