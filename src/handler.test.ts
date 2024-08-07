import { CloudWatch } from "@aws-sdk/client-cloudwatch";
import { SSM } from "@aws-sdk/client-ssm";
import type { Context } from "aws-lambda";
import {
    Agent,
    MockAgent,
    setGlobalDispatcher,
    fetch as undiciFetch,
} from "undici";
import * as handler from "../src/handler";

jest.mock("@aws-sdk/client-cloudwatch", () => {
    const putMetricData = jest.fn();
    class CloudWatchMock {
        putMetricData = putMetricData;
    }
    return { CloudWatch: CloudWatchMock };
});

jest.mock("@aws-sdk/client-ssm", () => {
    const getParameter = jest.fn();
    class SSMMock {
        getParameter = getParameter;
    }
    return { SSM: SSMMock };
});

const mockAgent = new MockAgent({ connections: 1 });
const originalFetch = global.fetch;

beforeAll(() => {
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    global.fetch = undiciFetch as unknown as typeof fetch;
});

afterAll(async () => {
    await mockAgent.close();
    setGlobalDispatcher(new Agent());
    global.fetch = originalFetch;
});

afterEach(() => {
    jest.resetAllMocks();
});

describe(handler.check.name, () => {
    describe(handler.log.name, () => {
        const originEnv = process.env;
        let spy: jest.SpyInstance;

        beforeAll(() => {
            spy = jest.spyOn(global.console, "log").mockImplementation();
        });

        afterAll(() => {
            spy.mockRestore();
        });

        beforeEach(() => {
            process.env = { ...originEnv };
            jest.resetModules();
        });

        afterEach(() => {
            process.env = originEnv;
        });

        test("no logging in test", () => {
            process.env.NODE_ENV = "test";
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require("../src/handler").log();
            expect(console.log).not.toHaveBeenCalled();
        });

        test("logging in production", () => {
            process.env.NODE_ENV = "production";
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require("../src/handler").log();
            expect(console.log).toHaveBeenCalled();
        });
    });

    describe(handler.asMetricData.name, () => {
        test("success", () => {
            const output: handler.Output = {
                duration_ms: 5.539833068847656,
                endpoint: "http://localhost",
                method: "POST",
                status_code: 200,
            };
            expect(handler.asMetricData(output)).toEqual({
                MetricData: [
                    {
                        Dimensions: [
                            {
                                Name: "Endpoint",
                                Value: "http://localhost",
                            },
                            {
                                Name: "Method",
                                Value: "POST",
                            },
                        ],
                        MetricName: "HTTPCode",
                        StatisticValues: {
                            Maximum: 1000,
                            Minimum: 0,
                            SampleCount: 1,
                            Sum: 200,
                        },
                        Unit: "None",
                    },
                    {
                        Dimensions: [
                            {
                                Name: "Endpoint",
                                Value: "http://localhost",
                            },
                            {
                                Name: "Method",
                                Value: "POST",
                            },
                        ],
                        MetricName: "Latency",
                        StatisticValues: {
                            Maximum: 30000,
                            Minimum: 0,
                            SampleCount: 1,
                            Sum: 5.539833068847656,
                        },
                        Unit: "Milliseconds",
                    },
                    {
                        Dimensions: [
                            {
                                Name: "Endpoint",
                                Value: "http://localhost",
                            },
                            {
                                Name: "Method",
                                Value: "POST",
                            },
                        ],
                        MetricName: "HTTPCode_2XX",
                        StatisticValues: {
                            Maximum: 1000,
                            Minimum: 0,
                            SampleCount: 1,
                            Sum: 1,
                        },
                        Unit: "None",
                    },
                ],
                Namespace: "status-checker/HTTP",
            });
        });

        test("error", () => {
            const output: handler.Output = {
                duration_ms: 5.539833068847656,
                endpoint: "http://localhost",
                error_code: "AbortError",
                method: "GET",
                status_code: 0,
            };
            expect(handler.asMetricData(output)).toEqual({
                MetricData: [
                    {
                        Dimensions: [
                            {
                                Name: "Endpoint",
                                Value: "http://localhost",
                            },
                            {
                                Name: "Method",
                                Value: "GET",
                            },
                        ],
                        MetricName: "HTTPCode",
                        StatisticValues: {
                            Maximum: 1000,
                            Minimum: 0,
                            SampleCount: 1,
                            Sum: 0,
                        },
                        Unit: "None",
                    },
                    {
                        Dimensions: [
                            {
                                Name: "Endpoint",
                                Value: "http://localhost",
                            },
                            {
                                Name: "Method",
                                Value: "GET",
                            },
                        ],
                        MetricName: "Latency",
                        StatisticValues: {
                            Maximum: 30000,
                            Minimum: 0,
                            SampleCount: 1,
                            Sum: 5.539833068847656,
                        },
                        Unit: "Milliseconds",
                    },
                ],
                Namespace: "status-checker/HTTP",
            });
        });
    });

    describe(handler.putMetricData.name, () => {
        const output: handler.Output = {
            duration_ms: 5.539833068847656,
            endpoint: "http://localhost",
            error_code: "AbortError",
            method: "GET",
            status_code: 0,
        };

        const cloudwatch = new CloudWatch() as unknown as {
            putMetricData: jest.Mock;
        };

        test("success", async () => {
            cloudwatch.putMetricData.mockResolvedValueOnce(1);
            const response = await handler.putMetricData(output);
            expect(response).toEqual(1);
            expect(cloudwatch.putMetricData).toHaveBeenCalledWith(
                handler.asMetricData(output),
            );
        });

        test("error", async () => {
            cloudwatch.putMetricData.mockRejectedValueOnce(new Error());
            const response = await handler.putMetricData(output);
            expect(response).toBeInstanceOf(Error);
        });
    });

    describe(handler.checkEndpoint.name, () => {
        const url = "http://localhost";

        test("get", async () => {
            mockAgent
                .get(url)
                .intercept({ method: "GET", path: "/" })
                .reply(200, "");

            const response = await handler.checkEndpoint({ url });
            expect(response).toMatchObject({
                endpoint: "http://localhost",
                method: "GET",
                status_code: 200,
            });
            expect(response.duration_ms).toBeGreaterThanOrEqual(0);
        });

        test("post", async () => {
            mockAgent
                .get(url)
                .intercept({ method: "POST", path: "/" })
                .reply(200, "");

            const response = await handler.checkEndpoint({
                url,
                method: "POST",
            });
            expect(response).toMatchObject({
                endpoint: "http://localhost",
                method: "POST",
                status_code: 200,
            });
            expect(response.duration_ms).toBeGreaterThanOrEqual(0);
        });

        test("error", async () => {
            mockAgent
                .get(url)
                .intercept({ method: "POST", path: "/" })
                .replyWithError(new Error(""));

            const response = await handler.checkEndpoint({
                url,
                method: "POST",
            });
            expect(response).toMatchObject({
                endpoint: "http://localhost",
                error_code: "TypeError",
                method: "POST",
                status_code: 0,
            });
            expect(response.duration_ms).toBeGreaterThanOrEqual(0);
        });

        test("timeout", async () => {
            mockAgent
                .get(url)
                .intercept({ method: "GET", path: "/" })
                .reply(200, "")
                .delay(200);

            const response = await handler.checkEndpoint(
                {
                    url,
                },
                20,
            );
            expect(response).toMatchObject({
                endpoint: "http://localhost",
                error_code: "AbortError",
                method: "GET",
                status_code: 0,
            });
            expect(response.duration_ms).toBeLessThanOrEqual(200);
        });
    });

    describe(handler.endpointsFromSsm.name, () => {
        const ssm = new SSM() as unknown as {
            getParameter: jest.Mock;
        };

        test("success", async () => {
            ssm.getParameter.mockResolvedValueOnce({
                Parameter: {
                    Value: Buffer.from(
                        JSON.stringify([{ url: "http://example.com" }]),
                    ).toString("base64"),
                },
            });

            expect(await handler.endpointsFromSsm("example-com")).toEqual([
                {
                    url: "http://example.com",
                },
            ]);
            expect(ssm.getParameter).toHaveBeenCalledWith({
                Name: "example-com",
                WithDecryption: true,
            });
        });

        test("error", async () => {
            ssm.getParameter.mockRejectedValue(new Error());
            expect(await handler.endpointsFromSsm("example-com")).toEqual([]);
            expect(ssm.getParameter).toHaveBeenCalled();
        });
    });

    describe(handler.endpointsFromParameter.name, () => {
        const ssm = new SSM() as unknown as {
            getParameter: jest.Mock;
        };

        test("cache", async () => {
            ssm.getParameter.mockResolvedValueOnce({
                Parameter: {
                    Value: Buffer.from(
                        JSON.stringify([{ url: "http://example.com" }]),
                    ).toString("base64"),
                },
            });

            const cache: Record<string, handler.Endpoint[]> = {};
            await handler.endpointsFromParameter("example-com", cache);
            await handler.endpointsFromParameter("example-com", cache);

            expect(ssm.getParameter).toHaveBeenCalledTimes(1);
            expect(cache).toEqual({
                "example-com": [
                    {
                        url: "http://example.com",
                    },
                ],
            });
        });
    });

    describe(handler.check.name, () => {
        const ssm = new SSM() as unknown as {
            getParameter: jest.Mock;
        };

        const cloudwatch = new CloudWatch() as unknown as {
            putMetricData: jest.Mock;
        };

        beforeEach(() => {
            ssm.getParameter.mockResolvedValueOnce({
                Parameter: {
                    Value: Buffer.from(
                        JSON.stringify([{ url: "http://example.com" }]),
                    ).toString("base64"),
                },
            });
        });

        const ctx = {} as unknown as Context;

        test("create cloudwatch metric", async () => {
            mockAgent
                .get("http://example.com")
                .intercept({ method: "GET", path: "/" })
                .reply(200, "");

            const cb = jest.fn();

            await handler.check({ parameter: "example-com" }, ctx, cb);

            expect(cb).not.toHaveBeenCalled();
            expect(cloudwatch.putMetricData).toHaveBeenCalledWith(
                expect.objectContaining({
                    Namespace: "status-checker/HTTP",
                    MetricData: expect.arrayContaining([
                        expect.objectContaining({
                            MetricName: "HTTPCode",
                            StatisticValues: expect.objectContaining({
                                SampleCount: 1,
                                Sum: 200,
                            }),
                        }),
                    ]),
                }),
            );
        });
    });
});
