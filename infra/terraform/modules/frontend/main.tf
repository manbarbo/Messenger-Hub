resource "aws_s3_bucket" "web" {
  bucket_prefix = "${var.name_prefix}-web-"
  force_destroy = false

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-web"
  })
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# Optional CRR (primary → DR bucket in sa-east-1)
resource "aws_s3_bucket_replication_configuration" "crr" {
  count  = var.enable_crr && var.crr_destination_bucket_arn != "" && var.crr_role_arn != "" ? 1 : 0
  bucket = aws_s3_bucket.web.id
  role   = var.crr_role_arn

  rule {
    id     = "replicate-web"
    status = "Enabled"

    destination {
      bucket        = var.crr_destination_bucket_arn
      storage_class = "STANDARD"
    }
  }

  depends_on = [aws_s3_bucket_versioning.web]
}

# --- CloudFront ---

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.name_prefix}-oac"
  description                       = "OAC for web bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} MessengerHub dashboard"
  price_class         = var.price_class
  default_root_object = "index.html"
  http_version        = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  dynamic "origin" {
    for_each = var.alb_dns_name == "" ? [] : [1]
    content {
      domain_name = var.alb_dns_name
      origin_id   = "alb-api"

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }

      custom_header {
        name  = "X-Origin-Verify"
        value = "messengerhub"
      }
    }
  }

  # SPA fallback → index.html
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # /api/* and /webhooks/* → ALB (no cache)
  dynamic "ordered_cache_behavior" {
    for_each = var.alb_dns_name == "" ? [] : ["/api/*", "/webhooks/*"]
    content {
      path_pattern           = ordered_cache_behavior.value
      allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods         = ["GET", "HEAD"]
      target_origin_id       = "alb-api"
      viewer_protocol_policy = "redirect-to-https"
      compress               = true

      forwarded_values {
        query_string = true
        headers      = ["Origin", "Content-Type", "Authorization"]
        cookies {
          forward = "none"
        }
      }

      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-cf"
  })
}
