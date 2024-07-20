import { CloudWatch } from "@aws-sdk/client-cloudwatch";
import { InvokeCommand, LambdaClient, LogType } from "@aws-sdk/client-lambda";

const config = {
    region: "eu-west-1",
    credentials: {
        accessKeyId: "testkey",
        secretAccessKey: "testsecret",
    },
};
const client = new LambdaClient({
    ...config,
    endpoint: "http://localhost:8080",
});

const cw = new CloudWatch({
    ...config,
    endpoint: "http://localhost:4566",
});

test("invoke", async () => {
    const res = await client.send(
        new InvokeCommand({
            FunctionName: "function",
            Payload: Buffer.from(
                JSON.stringify({
                    parameter: "/status-checker/localstack-init-ready",
                }),
            ),
            LogType: LogType.Tail,
        }),
    );

    expect(res.StatusCode).toEqual(200);
    expect(res.Payload).toBeDefined();
    expect(res.FunctionError).toBeUndefined();

    const metrics = await cw.listMetrics({
        Namespace: "status-checker/HTTP",
    });

    expect(metrics.Metrics).toEqual(
        expect.arrayContaining([
            {
                Dimensions: [
                    {
                        Name: "Endpoint",
                        Value: "http://localstack:4566/_localstack/init/ready",
                    },
                    {
                        Name: "Method",
                        Value: "GET",
                    },
                ],
                MetricName: "HTTPCode_2XX",
                Namespace: "status-checker/HTTP",
            },
            {
                Dimensions: [
                    {
                        Name: "Endpoint",
                        Value: "http://localstack:4566/_localstack/init/ready",
                    },
                    {
                        Name: "Method",
                        Value: "GET",
                    },
                ],
                MetricName: "Latency",
                Namespace: "status-checker/HTTP",
            },
        ]),
    );
});
