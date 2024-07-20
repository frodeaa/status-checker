# status-checker

status-checker is a small service which checks
the HTTP status code and latency for one or more
endpoints

The result is saved to AWS CloudWatch, where you can use
the result to trigger other events.

![Cloudwatch example](images/aws-console.png)

Following metrics are pushed to AWS CloudWatch using
namespace `status-checker/HTTP` and dimension `Endpoint`
and `Method`.

| MetricName   | Description            |         Unit |
| :----------- | :--------------------- | -----------: |
| Latency      | request time           | Milliseconds |
| HTTPCode     | HTTP status code       |         None |
| HTTPCode_YXX | Number of 2XX, 3XX,... |         None |

## Getting Started

status-checker is configured by providing a JSON list of objects
with following properties.

-   `url`: fully qualified URI, the endpoint to check
-   `method`: http method (default: "GET")
-   `headers` - http headers (default: {})

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

https://github.com/frodeaa/status-checker/blob/05b5ff7a9fef16c6892ff7abe4fdbc2ea700a218/cloudformation/create-status-checker-stack.sh#L3-L11

#### Configure status checker

Setup the status checker for an URL by creating a configuration stack

https://github.com/frodeaa/status-checker/blob/05b5ff7a9fef16c6892ff7abe4fdbc2ea700a218/cloudformation/create-status-checker-configuration-stack.sh#L3-L18

> The default schedule is every 5 minutes. It can be changed by using the
> `StatusCheckerScheduleExpression` parameter.

### View metrics

The metrics can be view in AWS console or by querying using `aws`.

```
aws cloudwatch get-metric-statistics \
    --metric-name Latency \
    --start-time 2020-07-25T20:00:00 \
    --end-time 2020-07-26T04:00:00 \
    --period 60 \
    --statistics Average \
    --namespace status-checker/HTTP \
    --dimensions \
       'Name=Method,Value=GET' \
       'Name=Endpoint,Value=http://example.com'
{
    "Label": "Latency",
    "Datapoints": [
        {
            "Timestamp": "2020-07-25T21:55:00+00:00",
            "Average": 249.07750599999986,
            "Unit": "Milliseconds"
        },
        {
            "Timestamp": "2020-07-25T21:50:00+00:00",
            "Average": 235.51812300000006,
            "Unit": "Milliseconds"
        }
    ]
}
```

## Development

> You can use `make` to run build and testing

```
make
build lint test                run yarn scripts
down up                        run docker compose commands
end-to-end-tests               run end-to-end-tests
```
