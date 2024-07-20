#!/bin/sh

configuration=$(cat <<EOF | base64
[
  {
    "url": "http://example.com"
  }
]
EOF
)

aws cloudformation create-stack \
    --stack-name "status-checker-example-com" \
    --template-body file://cloudformation/status-checker-configuration-template.yml \
    --parameters \
        "ParameterKey=StatusCheckerStackName,ParameterValue=status-checker" \
        "ParameterKey=StatusCheckerName,ParameterValue=example-com" \
        "ParameterKey=StatusCheckerConfiguration,ParameterValue=${configuration}"
