#!/usr/bin/env bash
set -euo pipefail
endpoint="${AWS_ENDPOINT_URL:-http://localstack:4566}"
bucket="${S3_BUCKET:-dayfeel-private}"
aws_local() { aws --endpoint-url "$endpoint" "$@"; }
ready=false
for attempt in {1..60}; do
  if aws_local s3api list-buckets >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" != true ]; then echo "LocalStack did not become ready" >&2; exit 1; fi
if ! aws_local s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
  if [ "${AWS_DEFAULT_REGION:-us-east-1}" = us-east-1 ]; then
    aws_local s3api create-bucket --bucket "$bucket" >/dev/null
  else
    aws_local s3api create-bucket --bucket "$bucket" --create-bucket-configuration "LocationConstraint=$AWS_DEFAULT_REGION" >/dev/null
  fi
fi
aws_local s3api put-public-access-block --bucket "$bucket" --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true'
aws_local s3api put-bucket-encryption --bucket "$bucket" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
echo "DayFeel S3 initialized."
