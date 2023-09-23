import fetch, { Headers, Request, Response } from "node-fetch";

// nock is currently not compatible with Node's experimental native
// `fetch` implementation, see https://github.com/nock/nock/issues/2397
if (!globalThis.fetch) {
    globalThis.fetch = fetch;
    globalThis.Headers = Headers;
    globalThis.Request = Request;
    globalThis.Response = Response;
}
