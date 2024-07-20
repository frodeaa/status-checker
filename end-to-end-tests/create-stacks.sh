#!/bin/bash

set -euo pipefail

export AWS_ACCESS_KEY_ID=testkey
export AWS_SECRET_ACCESS_KEY=testsecret
export AWS_DEFAULT_REGION=eu-west-1
export AWS_ENDPOINT_URL=http://localhost:4566
export BUCKET=status-checker-cnf-templates

printf "test %s\n" cloudformation/status-checker-template.yml
cloudformation/create-status-checker-stack.sh

printf "delete stack %s\n" status-checker
aws cloudformation delete-stack --stack-name status-checker

printf "test %s\n" cloudformation/status-checker-configuration-template.yml
cloudformation/create-status-checker-configuration-stack.sh

printf "delete stack %s\n" status-checker-example-com
aws cloudformation delete-stack --stack-name status-checker-example-com
