#!/bin/sh

aws cloudformation package \
    --template-file cloudformation/status-checker-template.yml \
    --output-template-file /tmp/deploy-status-checker-template.yml \
    --s3-bucket "${BUCKET}"

aws cloudformation deploy \
    --capabilities CAPABILITY_IAM \
    --template-file /tmp/deploy-status-checker-template.yml \
    --stack-name status-checker
