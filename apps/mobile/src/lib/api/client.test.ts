import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The regression this file exists for: an unreachable backend must never be reported as a
 * rejected session.
 *
 * `AuthProvider` deletes both stored tokens when an error carries `tokenStatus: "invalid"`.
 * The client used to wrap *any* failed token refresh — including a connection error — as
 * `SESSION_EXPIRED` with exactly that status, so a backend that was merely down logged the
 * user out for real and dropped them on a login page that also could not reach the server.
 * The tests below pin both halves: a network failure must not carry that marker, and a
 * genuine refusal still must.
 *
 * Secure storage and reachability are stubbed — neither has a native bridge in a node test.
 */

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

import { ApiClient, ApiError, isNetworkErrorLike } from "./client";
import { serverReachability } from "../serverReachability";

/** A response with headers, since the client reads `X-Token-Status` / `X-Request-Id`. */
const response = (
    status: number,
    body: unknown = {},
    headers: Record<string, string> = {}
): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name: string) => headers[name] ?? null },
        json: async () => body,
    }) as unknown as Response;

/** A client already holding both tokens, as it would be after a successful login. */
const authedClient = (): ApiClient => {
    const client = new ApiClient();
    client.setAccessToken("stale-access-token");
    client.setRefreshToken("refresh-token");
    client.markAuthReady();
    return client;
};

/** The 401 that sends the client into its refresh path. */
const expiredAccessToken = () => response(401, {}, { "X-Token-Status": "invalid" });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("isNetworkErrorLike", () => {
    it.each([
        ["Chrome / Android WebView", new TypeError("Failed to fetch")],
        ["WebKit", new TypeError("Load failed")],
        ["Capacitor bridge", new Error("Network request failed")],
        ["Firefox", new Error("NetworkError when attempting to fetch resource.")],
    ])("recognises a %s connection failure", (_engine, error) => {
        expect(isNetworkErrorLike(error)).toBe(true);
    });

    it("does not claim an ordinary error is a network failure", () => {
        expect(isNetworkErrorLike(new Error("something else went wrong"))).toBe(false);
        expect(isNetworkErrorLike("not an error")).toBe(false);
    });
});

describe("token refresh when the server is unreachable", () => {
    it("does not report a connection failure as an invalid session", async () => {
        const client = authedClient();
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken()) // original request
            .mockRejectedValueOnce(new TypeError("Failed to fetch")); // refresh call

        const error = await client.get("/api/stores").catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        // The exact condition AuthProvider uses to wipe stored tokens.
        expect(apiError.tokenStatus).not.toBe("invalid");
        expect(apiError.isNetworkError).toBe(true);
        expect(apiError.code).toBe("REFRESH_UNREACHABLE");
    });

    it("keeps the refresh token so the session survives the outage", async () => {
        const client = authedClient();
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken())
            .mockRejectedValueOnce(new TypeError("Failed to fetch"));

        await client.get("/api/stores").catch(() => undefined);

        // Proof the token wasn't discarded: the next attempt reaches the refresh endpoint
        // again rather than failing outright for want of one.
        fetchMock.mockReset();
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken())
            .mockResolvedValueOnce(response(200, { accessToken: "fresh" }))
            .mockResolvedValueOnce(response(200, { stores: [] }));

        await expect(client.get("/api/stores")).resolves.toEqual({ stores: [] });
    });

    it("reports a 502 on the refresh call as unreachable, not as a dead session", async () => {
        const client = authedClient();
        fetchMock.mockResolvedValueOnce(expiredAccessToken()).mockResolvedValueOnce(response(502));

        const error = (await client.get("/api/stores").catch((e: unknown) => e)) as ApiError;

        expect(error.tokenStatus).not.toBe("invalid");
        expect(error.isNetworkError).toBe(true);
        expect(error.code).toBe("SERVER_UNAVAILABLE");
    });

    it("still ends the session when the server genuinely refuses the refresh token", async () => {
        const client = authedClient();
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken())
            .mockResolvedValueOnce(
                response(
                    401,
                    { code: "REFRESH_FAILED", message: "Refresh token expired" },
                    { "X-Token-Status": "invalid" }
                )
            );

        const error = (await client.get("/api/stores").catch((e: unknown) => e)) as ApiError;

        expect(error.tokenStatus).toBe("invalid");
        expect(error.isNetworkError).toBe(false);
    });

    it("retries the original request after a successful refresh", async () => {
        const client = authedClient();
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken())
            .mockResolvedValueOnce(response(200, { accessToken: "fresh-access-token" }))
            .mockResolvedValueOnce(response(200, { stores: ["a"] }));

        await expect(client.get("/api/stores")).resolves.toEqual({ stores: ["a"] });

        const retryHeaders = fetchMock.mock.calls[2][1].headers;
        expect(retryHeaders["Authorization"]).toBe("Bearer fresh-access-token");
    });
});

describe("classifying an unreachable server", () => {
    it("tags a connection failure as a network error", async () => {
        const client = authedClient();
        fetchMock.mockRejectedValueOnce(new TypeError("Load failed"));

        const error = (await client.get("/api/stores").catch((e: unknown) => e)) as ApiError;

        expect(error.isNetworkError).toBe(true);
        expect(error.code).toBe("NETWORK_ERROR");
        expect(serverReachability.reportUnreachable).toHaveBeenCalled();
    });

    it.each([502, 503, 504])(
        "tags a %i from the proxy as a network error so it queues like one",
        async (status) => {
            const client = authedClient();
            fetchMock.mockResolvedValueOnce(response(status));

            const error = (await client.get("/api/stores").catch((e: unknown) => e)) as ApiError;

            expect(error.isNetworkError).toBe(true);
            expect(error.code).toBe("SERVER_UNAVAILABLE");
            expect(serverReachability.reportUnreachable).toHaveBeenCalled();
        }
    );

    it("leaves an ordinary application error alone", async () => {
        const client = authedClient();
        fetchMock.mockResolvedValueOnce(
            response(409, { code: "ITEM_NAME_CONFLICT", message: "Apples already exists" })
        );

        const error = (await client.get("/api/stores").catch((e: unknown) => e)) as ApiError;

        expect(error.isNetworkError).toBe(false);
        expect(error.code).toBe("ITEM_NAME_CONFLICT");
    });

    it("treats any answer from the server as proof it is up", async () => {
        const client = authedClient();
        fetchMock.mockResolvedValueOnce(response(404, { code: "NOT_FOUND" }));

        await client.get("/api/stores").catch(() => undefined);

        // A 404 is the server talking, so it clears an outage rather than prolonging one.
        expect(serverReachability.reportReachable).toHaveBeenCalled();
        expect(serverReachability.reportUnreachable).not.toHaveBeenCalled();
    });
});

describe("base URL", () => {
    it("keeps health probes pointed at the configured host", () => {
        const client = new ApiClient();
        client.setBaseUrl("https://custom.example");

        expect(client.getBaseUrl()).toBe("https://custom.example");
        expect(serverReachability.setBaseUrl).toHaveBeenCalledWith("https://custom.example");
    });
});

describe("openStream", () => {
    const streamPath = "/api/stores/store-1/events";

    it("sends the bearer token and resolves with the open response", async () => {
        const client = authedClient();
        const ok = response(200);
        fetchMock.mockResolvedValueOnce(ok);

        const controller = new AbortController();
        await expect(client.openStream(streamPath, controller.signal)).resolves.toBe(ok);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toMatch(/\/api\/stores\/store-1\/events$/);
        expect(init.headers["Authorization"]).toBe("Bearer stale-access-token");
        expect(init.headers["Accept"]).toBe("text/event-stream");
        // The caller's signal, not a timeout controller: the stream must stay open.
        expect(init.signal).toBe(controller.signal);
        expect(serverReachability.reportReachable).toHaveBeenCalled();
    });

    it("applies no request timeout", async () => {
        vi.useFakeTimers();
        try {
            const client = authedClient();
            let seenSignal: AbortSignal | undefined;
            fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => {
                seenSignal = init.signal ?? undefined;
                return response(200);
            });

            await client.openStream(streamPath, new AbortController().signal);
            await vi.advanceTimersByTimeAsync(60_000);

            expect(seenSignal?.aborted).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("waits for auth to be ready before connecting", async () => {
        const client = new ApiClient();
        client.setAccessToken("token");
        fetchMock.mockResolvedValue(response(200));

        const pending = client.openStream(streamPath, new AbortController().signal);
        await Promise.resolve();
        expect(fetchMock).not.toHaveBeenCalled();

        client.markAuthReady();
        await pending;
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("refreshes once on an invalid token and retries with the new one", async () => {
        const client = authedClient();
        const ok = response(200);
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken())
            .mockResolvedValueOnce(response(200, { accessToken: "fresh-access-token" }))
            .mockResolvedValueOnce(ok);

        await expect(client.openStream(streamPath, new AbortController().signal)).resolves.toBe(ok);

        expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/auth\/refresh$/);
        expect(fetchMock.mock.calls[2][1].headers["Authorization"]).toBe(
            "Bearer fresh-access-token"
        );
    });

    it("does not loop when the retried stream is refused again", async () => {
        const client = authedClient();
        fetchMock
            .mockResolvedValueOnce(expiredAccessToken())
            .mockResolvedValueOnce(response(200, { accessToken: "fresh-access-token" }))
            .mockResolvedValueOnce(expiredAccessToken());

        const error = (await client
            .openStream(streamPath, new AbortController().signal)
            .catch((e: unknown) => e)) as ApiError;

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("rejects with the status for a forbidden store", async () => {
        const client = authedClient();
        fetchMock.mockResolvedValueOnce(response(403, { code: "FORBIDDEN", message: "No" }));

        const error = (await client
            .openStream(streamPath, new AbortController().signal)
            .catch((e: unknown) => e)) as ApiError;

        expect(error.status).toBe(403);
        expect(error.isNetworkError).toBe(false);
    });

    // A stream that cannot connect says nothing about the server: the socket is dropped
    // routinely (backgrounded app, idle proxy, expired JWT) and the caller reconnects on its
    // own backoff. Reporting it raised the "Network down" banner - and so shifted the whole
    // list down and back - on every app resume.
    it("does not report a connection failure as unreachable", async () => {
        const client = authedClient();
        fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        const error = (await client
            .openStream(streamPath, new AbortController().signal)
            .catch((e: unknown) => e)) as ApiError;

        expect(error.isNetworkError).toBe(true);
        expect(serverReachability.reportUnreachable).not.toHaveBeenCalled();
    });

    it("does not report a proxy outage status as unreachable", async () => {
        const client = authedClient();
        fetchMock.mockResolvedValueOnce(response(503));

        const error = (await client
            .openStream(streamPath, new AbortController().signal)
            .catch((e: unknown) => e)) as ApiError;

        expect(error.isNetworkError).toBe(true);
        expect(error.status).toBe(503);
        expect(serverReachability.reportUnreachable).not.toHaveBeenCalled();
    });

    it("passes a caller abort through without blaming the server", async () => {
        const client = authedClient();
        const controller = new AbortController();
        fetchMock.mockImplementationOnce(async () => {
            controller.abort();
            throw new DOMException("The operation was aborted.", "AbortError");
        });

        const error = await client.openStream(streamPath, controller.signal).catch((e) => e);

        expect((error as Error).name).toBe("AbortError");
        expect(serverReachability.reportUnreachable).not.toHaveBeenCalled();
    });
});
