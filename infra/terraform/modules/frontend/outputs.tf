output "web_bucket_id" {
  value = aws_s3_bucket.web.id
}

output "web_bucket_arn" {
  value = aws_s3_bucket.web.arn
}

output "web_bucket_domain_name" {
  value = aws_s3_bucket.web.bucket_regional_domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_distribution_arn" {
  value = aws_cloudfront_distribution.this.arn
}
