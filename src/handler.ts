import {
    CloudWatch,
    type MetricDatum,
    type PutMetricDataCommandInput,
} from "@aws-sdk/client-cloudwatch";
import { SSM } from "@aws-sdk/client-ssm";
import type { Handler } from "aws-lambda";

type RequestInit = Parameters<typeof fetch>[1];

export type Endpoint = RequestInit & {
    url: string;
    headers?: Record<string, string>;
};

export type Output = {
    endpoint: string;
    method: string;
    error_code?: unknown;
    status_code: number;
    duration_ms: number;
};

const ssm = new SSM({
    endpoint: process.env.AWS_ENDPOINT_URL,
});

const cloudwatch = new CloudWatch({
    endpoint: process.env.AWS_ENDPOINT_URL,
});

export const log = process.env.NODE_ENV === "test" ? () => {} : console.log;

const metric = (
    name: string,
    dimensions: MetricDatum["Dimensions"],
    sum: number,
): MetricDatum => ({
    MetricName: name,
    Dimensions: dimensions,
    StatisticValues: {
        SampleCount: 1,
        Sum: sum,
        Minimum: 0,
        Maximum: 1000,
    },
    Unit: "None",
});

export const asMetricData = (output: Output): PutMetricDataCommandInput => {
    const dimensions = [
        {
            Name: "Endpoint",
            Value: output.endpoint,
        },
        {
            Name: "Method",
            Value: output.method,
        },
    ];

    const status = output.status_code;
    const metricData = [
        metric("HTTPCode", dimensions, status),
        {
            MetricName: "Latency",
            Dimensions: dimensions,
            StatisticValues: {
                SampleCount: 1,
                Sum: output.duration_ms,
                Minimum: 0,
                Maximum: 30000,
            },
            Unit: "Milliseconds" as const,
        },
    ];

    if (status < 1000 && status > 99) {
        const suffix = `${status}`.replace(/(\d{2}$)/, "XX");
        metricData.push(metric(`HTTPCode_${suffix}`, dimensions, 1));
    }

    return {
        Namespace: "status-checker/HTTP",
        MetricData: metricData,
    };
};

export const putMetricData = async (output: Output) => {
    const params = asMetricData(output);
    try {
        const response = await cloudwatch.putMetricData(params);
        log(`logged metrics to CloudWatch at: ${params.Namespace}`, response);
        return response;
    } catch (error) {
        log("failed posting metrics to CloudWatch");
        log(error, (error as Error).stack);
        return error;
    }
};

export const checkEndpoint = async (
    endpoint: Endpoint,
    timeout = 10000,
): Promise<Output> => {
    const defaultMethod = "GET";
    const options: Endpoint = JSON.parse(JSON.stringify(endpoint));
    options.headers = options.headers || {};
    options.headers["User-Agent"] = "status-checker";
    options.method = options.method || defaultMethod;

    const { url } = options;
    const start = performance.now();
    const controller = new AbortController();
    options.signal = controller.signal;

    const timeoutId = setTimeout(() => controller.abort(), timeout);
    let statusCode = -1;
    try {
        const response = await fetch(url, options);
        statusCode = response.status;
        return {
            endpoint: options.url,
            method: options.method,
            status_code: statusCode,
            duration_ms: performance.now() - start,
        };
    } catch (err) {
        return {
            endpoint: options.url,
            method: options.method as string,
            status_code: 0,
            duration_ms: performance.now() - start,
            error_code: (err as Error).name,
        };
    } finally {
        clearTimeout(timeoutId);
        log(`checked ${options.method} ${options.url} ${statusCode}`);
    }
};

export const endpointsFromSsm = async (name: string): Promise<Endpoint[]> => {
    try {
        const result = await ssm.getParameter({
            Name: name,
            WithDecryption: true,
        });
        return JSON.parse(
            Buffer.from(result.Parameter?.Value as string, "base64").toString(
                "ascii",
            ),
        );
    } catch (error) {
        log("Failed to fetch endpoints from SSM", error);
        return [];
    }
};

export const endpointsFromParameter = async (
    name: string,
    cache: Record<string, Endpoint[]>,
): Promise<Endpoint[]> => {
    if (!cache[name]) {
        cache[name] = await endpointsFromSsm(name);
    }
    return cache[name];
};

const checkEndpointAndPutMetricData = async (
    endpoint: Endpoint,
): Promise<Output> => {
    const output = await checkEndpoint(endpoint);
    await putMetricData(output);
    return output;
};

const cache: Record<string, Endpoint[]> = {};

export const check: Handler<{ parameter: string }> = async (event) => {
    log(event);
    const endpoints = await endpointsFromParameter(event.parameter, cache);
    const outputs = await Promise.all(
        endpoints.map(checkEndpointAndPutMetricData),
    );
    log(outputs);
};
