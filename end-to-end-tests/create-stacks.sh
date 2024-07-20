#!/bin/bash

set -euo pipefail

export AWS_ACCESS_KEY_ID=testkey
export AWS_SECRET_ACCESS_KEY=testsecret
export AWS_DEFAULT_REGION=eu-west-1
export AWS_ENDPOINT_URL=http://localhost:4566
export BUCKET=status-checker-cnf-templates

printf "test %s\n" cloudformation/status-checker-template.yml

aws cloudformation package \
    --template-file cloudformation/status-checker-template.yml \
    --output-template-file /tmp/deploy-status-checker-template.yml \
    --s3-bucket "${BUCKET}"

aws cloudformation deploy \
    --capabilities CAPABILITY_IAM \
    --template-file /tmp/deploy-status-checker-template.yml \
    --stack-name status-checker

configuration=$(cat <<EOF | base64
[
  {
    "url": "http://localstack:5466/"
  }
]
EOF
)

printf "test %s\n" cloudformation/status-checker-configuration-template.yml

aws cloudformation create-stack \
    --stack-name status-checker-example-com-$RANDOM \
    --template-body file://cloudformation/status-checker-configuration-template.yml \
    --parameters \
        "ParameterKey=StatusCheckerStackName,ParameterValue=status-checker" \
        "ParameterKey=StatusCheckerName,ParameterValue=example-com" \
        "ParameterKey=StatusCheckerConfiguration,ParameterValue=${configuration}"
