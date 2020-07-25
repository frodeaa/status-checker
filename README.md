# status-checker

status-checker is a small service which checks
the HTTP status code and latency for one or more
endpoints

The result is save to AWS CloudWatch, where you can use
the result to trigger other events.

![Cloudwatch example](images/aws-console.png)

Following metrics are pushed to AWS CloudWatch using
namespace `status-checker/HTTP` and dimension `Endpoint`
and `Method`.

| MetricName   | Description            | Unit         |
| ------------ | ---------------------- | ------------:|
| Latency      | request time           | Milliseconds |
| HTTPCode     | HTTP status code       | None         |
| HTTPCode_YXX | Number of 2XX, 3XX,... | None         |

## Getting Started

status-checker is configured by providing a JSON list of objects
with following properties.

 - `url`: fully qualified uri
 - `method`: http method (default: "GET")
 - `headers` - http headers (default: {})

### Example

```
[
    {"url": "example.com"},
    {"url": "post.example.com", "method": "POST"},
    {"url": "test.example.com", "headers": {"Authorization": "Basic "}}
]
```

### Installing

The application can be deployed with aws cloudformation.

```
yarn install --production

aws cloudformation package \
    --template-file cloudformation/status-checker-template.yml \
    --output-template-file /tmp/deploy-status-checker-template.yml \
    --s3-bucket "${BUCKET}"

aws cloudformation deploy \
    --capabilities CAPABILITY_IAM \
    --template-file /tmp/deploy-status-checker-template.yml \
    --stack-name status-checker
```

#### Configure status checker

Add one or more URLs to check using the status-checker.

```
configuration=$(cat <<EOF | base64
[
  {
    "url": "http://example.com"
  }
]
EOF
)

aws cloudformation create-stack \
    --stack-name status-checker-example-com \
    --template-body file://cloudformation/status-checker-configuration-template.yml \
    --parameters \
        "ParameterKey=StatusCheckerStackName,ParameterValue=status-checker" \
        "ParameterKey=StatusCheckerName,ParameterValue=example-com" \
        "ParameterKey=StatusCheckerConfiguration,ParameterValue=${configuration}"
```

The metrics can be view in AWS console or by querying using aws

```
aws cloudwatch get-metric-statistics \
   --metric-name Latency \
   --start-time 2018-01-30T20:00:00 \
   --end-time 2018-01-30T23:00:00 \
   --period 60 \
   --statistics Average \
   --namespace status-checker/HTTP \
   --dimensions Name=Method,Value=GET,Name=Endpoint,Value=http://example.com
{
    "Datapoints": [
        {
            "Timestamp": "2018-01-28T20:26:00Z",
            "Average": 148.87248999999997,
            "Unit": "Milliseconds"
        },
        {
            "Timestamp": "2018-01-28T20:25:00Z",
            "Average": 227.27127999999993,
            "Unit": "Milliseconds"
        },
        {
            "Timestamp": "2018-01-28T20:20:00Z",
            "Average": 158.15730199999985,
            "Unit": "Milliseconds"
        }
    ],
    "Label": "Latency"
}
```


