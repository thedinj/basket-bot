import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/secureStorage", () => ({
    KEYS: { ACCESS_TOKEN: "auth_access_token", REFRESH_TOKEN: "auth_refresh_token" },
    secureStorage: {
        get: vi.fn(async () => null),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
    },
}));

vi.mock("../serverReachability", () => ({
    serverReachability: {
        setBaseUrl: vi.fn(),
        reportUnreachable: vi.fn(),
        reportReachable: vi.fn(),
        isUnreachable: vi.fn(() => false),
    },
}));

import { ApiClient } from "../api/client";
import {
    backoffDelay,
    connectStoreEvents,
    createSseParser,
    SILENCE_TIMEOUT_MS,
    type SseFrame,
    type StoreEventHandlers,
} from "./storeEventStream";

/** An SSE body the test writes to and closes by hand, like a live server connection. */
const liveBody = () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            controller = c;
        },
    });
    return {
        stream,
        send: (text: string) => controller.enqueue(encoder.encode(text)),
        close: () => controller.close(),
    };
};

const sseResponse = (body: ReadableStream<Uint8Array>) =>
    new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });

const jsonResponse = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });

const READY = "event: ready\ndata: {}\n\n";
const change = (kind: string) => `event: change\ndata: {"kind":"${kind}"}\n\n`;

const handlers = () => ({
    onChange: vi.fn<StoreEventHandlers["onChange"]>(),
    onResync: vi.fn<StoreEventHandlers["onResync"]>(),
    onAccessLost: vi.fn<StoreEventHandlers["onAccessLost"]>(),
    onConnectionChange: vi.fn<NonNullable<StoreEventHandlers["onConnectionChange"]>>(),
});

/** A signed-in client whose requests go to the stubbed `fetch`. */
const makeClient = () => {
    const client = new ApiClient();
    client.setAccessToken("access-token");
    client.setRefreshToken("refresh-token");
    client.markAuthReady();
    return client;
};

/** Let pending promise chains (fetch → read loop → handlers) run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

let fetchMock: ReturnType<typeof vi.fn>;
let client: ApiClient;
const connect = (h: ReturnType<typeof handlers>) =>
    connectStoreEvents("store-1", h, {
        openStream: (path, signal) => client.openStream(path, signal),
        random: () => 1,
    });

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = makeClient();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("createSseParser", () => {
    const parse = (chunks: string[]): SseFrame[] => {
        const frames: SseFrame[] = [];
        const parser = createSseParser((frame) => frames.push(frame));
        chunks.forEach((chunk) => parser.push(chunk));
        parser.end();
        return frames;
    };

    it("parses whole frames", () => {
        expect(parse([READY + change("list")])).toEqual([
            { event: "ready", data: "{}" },
            { event: "change", data: '{"kind":"list"}' },
        ]);
    });

    it("reassembles frames split at arbitrary chunk boundaries", () => {
        const text = READY + change("layout");
        const oneByteChunks = text.split("");
        expect(parse(oneByteChunks)).toEqual([
            { event: "ready", data: "{}" },
            { event: "change", data: '{"kind":"layout"}' },
        ]);
    });

    it("joins multi-line data with newlines", () => {
        expect(parse(["event: x\ndata: first\ndata: second\n\n"])).toEqual([
            { event: "x", data: "first\nsecond" },
        ]);
    });

    it("ignores comment lines such as heartbeats", () => {
        expect(parse([": hb\n\n", ": hb\n", READY])).toEqual([{ event: "ready", data: "{}" }]);
    });

    it("handles CRLF line endings, including a CR/LF pair split across chunks", () => {
        expect(parse(["event: ready\r", "\ndata: {}\r\n\r", "\n"])).toEqual([
            { event: "ready", data: "{}" },
        ]);
    });

    it("defaults the event name to message and drops an unterminated frame", () => {
        expect(parse(["data: hello\n\n", "event: change\ndata: cut-off"])).toEqual([
            { event: "message", data: "hello" },
        ]);
    });
});

describe("backoffDelay", () => {
    it("doubles from 1 s and caps at 30 s", () => {
        const delays = [0, 1, 2, 3, 4, 5, 6, 10].map((n) => backoffDelay(n, () => 1));
        expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    });

    it("jitters down to 75 % of the step", () => {
        expect(backoffDelay(0, () => 0)).toBe(750);
        expect(backoffDelay(10, () => 0)).toBe(22500);
    });
});

describe("connectStoreEvents", () => {
    it("connects with the bearer token and resyncs on ready", async () => {
        const body = liveBody();
        fetchMock.mockResolvedValueOnce(sseResponse(body.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        body.send(READY);
        await settle();

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toMatch(/\/api\/stores\/store-1\/events$/);
        expect(init.headers["Authorization"]).toBe("Bearer access-token");
        expect(h.onResync).toHaveBeenCalledTimes(1);
        expect(h.onConnectionChange).toHaveBeenLastCalledWith(true);
        stream.close();
    });

    it("delivers change kinds and ignores malformed payloads and heartbeats", async () => {
        const body = liveBody();
        fetchMock.mockResolvedValueOnce(sseResponse(body.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        body.send(READY + change("list") + ": hb\n\n" + change("nonsense"));
        body.send("event: change\ndata: not json\n\n" + change("layout"));
        await settle();

        expect(h.onChange.mock.calls).toEqual([["list"], ["layout"]]);
        stream.close();
    });

    it("reconnects after the server closes the stream and resyncs again", async () => {
        const first = liveBody();
        const second = liveBody();
        fetchMock
            .mockResolvedValueOnce(sseResponse(first.stream))
            .mockResolvedValueOnce(sseResponse(second.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        first.send(READY);
        await settle();
        first.close(); // e.g. the access token expired
        await settle();

        expect(h.onConnectionChange).toHaveBeenLastCalledWith(false);
        await vi.advanceTimersByTimeAsync(999);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        second.send(READY);
        await settle();
        expect(h.onResync).toHaveBeenCalledTimes(2);
        stream.close();
    });

    it("backs off exponentially while the server is unreachable, and resets on ready", async () => {
        const body = liveBody();
        fetchMock
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(sseResponse(body.stream))
            .mockRejectedValue(new TypeError("Failed to fetch"));
        const h = handlers();

        const stream = connect(h);
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1999);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(4000);
        expect(fetchMock).toHaveBeenCalledTimes(4);

        body.send(READY);
        await settle();
        body.close();
        await settle();
        // Back to the first step after a successful connection.
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchMock).toHaveBeenCalledTimes(5);
        stream.close();
    });

    it("refreshes an expired access token and connects with the new one", async () => {
        const body = liveBody();
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, {}, { "X-Token-Status": "invalid" }))
            .mockResolvedValueOnce(jsonResponse(200, { accessToken: "fresh-token" }))
            .mockResolvedValueOnce(sseResponse(body.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        body.send(READY);
        await settle();

        expect(fetchMock.mock.calls[2][1].headers["Authorization"]).toBe("Bearer fresh-token");
        expect(h.onResync).toHaveBeenCalledTimes(1);
        expect(h.onAccessLost).not.toHaveBeenCalled();
        stream.close();
    });

    it.each([403, 404])("stops for good on a %i", async (status) => {
        fetchMock.mockResolvedValue(jsonResponse(status, { code: "X", message: "no" }));
        const h = handlers();

        connect(h);
        await settle();
        await vi.advanceTimersByTimeAsync(120_000);

        expect(h.onAccessLost).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("stops for good when the session is over", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, {}, { "X-Token-Status": "invalid" }))
            .mockResolvedValueOnce(
                jsonResponse(401, { code: "REFRESH_FAILED" }, { "X-Token-Status": "invalid" })
            );
        const h = handlers();

        connect(h);
        await settle();
        await vi.advanceTimersByTimeAsync(120_000);

        expect(h.onAccessLost).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("stops for good on an access event", async () => {
        const body = liveBody();
        fetchMock.mockResolvedValue(sseResponse(body.stream));
        const h = handlers();

        connect(h);
        await settle();
        body.send(READY + "event: access\ndata: {}\n\n");
        await settle();
        // The client hung up on its side (the body is cancelled).
        expect(() => body.close()).toThrow();
        await vi.advanceTimersByTimeAsync(120_000);

        expect(h.onAccessLost).toHaveBeenCalledTimes(1);
        expect(h.onConnectionChange).toHaveBeenLastCalledWith(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("replaces a connection that has gone silent", async () => {
        const first = liveBody();
        const second = liveBody();
        fetchMock
            .mockResolvedValueOnce(sseResponse(first.stream))
            .mockResolvedValueOnce(sseResponse(second.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        first.send(READY);
        await settle();
        // Heartbeats keep it alive...
        await vi.advanceTimersByTimeAsync(SILENCE_TIMEOUT_MS - 1000);
        first.send(": hb\n\n");
        await vi.advanceTimersByTimeAsync(SILENCE_TIMEOUT_MS - 1000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // ...silence does not.
        await vi.advanceTimersByTimeAsync(1000 + 1000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        stream.close();
    });

    it("reconnect() drops the current connection and connects again at once", async () => {
        const first = liveBody();
        const second = liveBody();
        fetchMock
            .mockResolvedValueOnce(sseResponse(first.stream))
            .mockResolvedValueOnce(sseResponse(second.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        first.send(READY);
        await settle();

        stream.reconnect();
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // The old connection is dead: nothing it says is delivered.
        expect(() => first.send(change("list"))).toThrow();
        second.send(READY);
        await settle();
        expect(h.onResync).toHaveBeenCalledTimes(2);
        stream.close();
    });

    it("close() stops delivery and never reconnects", async () => {
        const body = liveBody();
        fetchMock.mockResolvedValue(sseResponse(body.stream));
        const h = handlers();

        const stream = connect(h);
        await settle();
        body.send(READY);
        await settle();
        stream.close();
        await vi.advanceTimersByTimeAsync(120_000);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(h.onAccessLost).not.toHaveBeenCalled();
        expect(h.onConnectionChange).toHaveBeenLastCalledWith(false);
    });
});
