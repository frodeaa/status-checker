#!/bin/sh

configuration=$(cat <<EOF | base64
  [
    {
      "url": "http://localstack:4566/_localstack/init/ready"
    }
  ]
EOF
)

awslocal ssm put-parameter \
  --name /status-checker/localstack-init-ready \
  --value "$configuration" \
  --type String
