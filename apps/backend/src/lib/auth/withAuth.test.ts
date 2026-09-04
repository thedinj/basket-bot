import { NotFoundError } from "@basket-bot/core";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../../test/support/resetDb";
import { generateAccessToken } from "./jwt";
import { withAuth, type AuthenticatedRequest, type RouteHandler } from "./withAuth";

/**
 * `withAuth` is 53 lines that stand in front of all 64 route handlers, so every one of its
 * branches is a whole-API behaviour: reject unauthenticated callers, enforce the admin scope, and
 * hand the handler a request it can trust. It is also the one place that sets `X-Token-Status`,
 * which the mobile client reads to decide between refreshing the session and logging the user out
 * — get that wrong and an expired token becomes a forced sign-out.
 *
 * Built against a real `NextRequest` rather than a Next server: node has `Request`/`Headers`, and
 * the middleware never touches anything a running server would provide.
 */

const request = (headers: Record<string, string> = {}): NextRequest =>
    new NextRequest("https://example.test/api/stores/abc", { method: "GET", headers });

const bearer = (scopes: string[] = []): Record<string, string> => ({
    authorization: `Bearer ${generateAccessToken({
        userId: crypto.randomUUID(),
        email: "user@example.test",
        scopes,
    })}`,
});

/** A handler that reports back what it was handed, so the test can inspect it. */
const echoHandler: RouteHandler = async (req, context) =>
    NextResponse.json({ sub: req.auth.sub, scopes: req.auth.scopes, params: await context.params });

const context = { params: Promise.resolve({ id: "abc" }) };

const call = async (
    handler: RouteHandler,
    headers: Record<string, string>,
    options?: Parameters<typeof withAuth>[1]
) => {
    const response = await withAuth(handler, options)(request(headers), context);
    return { response, json: (await response.json()) as Record<string, unknown> };
};

beforeEach(() => {
    resetDb();
    // Rejections are logged to the console and the ErrorLog table by design.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("authentication", () => {
    const rejected: Array<[string, Record<string, string>]> = [
        ["no header at all", {}],
        ["an empty header", { authorization: "" }],
        ["a bare token with no scheme", { authorization: "some-token" }],
        ["the wrong scheme", { authorization: "Basic dXNlcjpwYXNz" }],
        // `startsWith("Bearer ")` is case-sensitive, and this pins that on purpose: the client
        // only ever sends the canonical casing, so loosening it would widen the surface for free.
        ["lowercase bearer", { authorization: "bearer abc.def.ghi" }],
        ["a syntactically invalid token", { authorization: "Bearer not-a-jwt" }],
    ];

    it.each(rejected)("rejects %s with 401", async (_name, headers) => {
        const handler = vi.fn(echoHandler);

        const { response, json } = await call(handler, headers);

        expect(response.status).toBe(401);
        expect(json.code).toBe("AUTHENTICATION_FAILED");
        expect(handler).not.toHaveBeenCalled();
    });

    it("rejects a token signed with a different secret", async () => {
        const handler = vi.fn(echoHandler);
        // Same payload shape, wrong signature — the kind of token a stale or spoofed client sends.
        const foreign =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
            "eyJzdWIiOiJ1c2VyIiwic2NvcGVzIjpbImFkbWluIl19." +
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        const { response } = await call(handler, { authorization: `Bearer ${foreign}` });

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it("rejects an expired token", async () => {
        const handler = vi.fn(echoHandler);
        const headers = bearer();

        // Access tokens are short-lived; jump past any plausible TTL.
        vi.useFakeTimers();
        vi.setSystemTime(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
        try {
            const { response } = await call(handler, headers);
            expect(response.status).toBe(401);
        } finally {
            vi.useRealTimers();
        }
        expect(handler).not.toHaveBeenCalled();
    });

    /**
     * The mobile client branches on this header: present means "refresh and retry", absent means
     * the failure was something else and the request should surface as an error.
     */
    it("marks a token failure with X-Token-Status so the client can refresh", async () => {
        const { response } = await call(echoHandler, {});

        expect(response.headers.get("X-Token-Status")).toBe("invalid");
    });

    it("does not mark a non-token failure", async () => {
        const handler: RouteHandler = async () => {
            throw new NotFoundError("Store not found");
        };

        const { response } = await call(handler, bearer());

        expect(response.status).toBe(404);
        expect(response.headers.get("X-Token-Status")).toBeNull();
    });
});

describe("a valid token", () => {
    it("attaches the payload and passes the route params through untouched", async () => {
        const token = generateAccessToken({
            userId: "user-1",
            email: "user@example.test",
            scopes: ["admin"],
        });

        const { response, json } = await call(echoHandler, {
            authorization: `Bearer ${token}`,
        });

        expect(response.status).toBe(200);
        expect(json).toEqual({ sub: "user-1", scopes: ["admin"], params: { id: "abc" } });
    });

    it("returns the handler's own response verbatim", async () => {
        const handler: RouteHandler = async () =>
            NextResponse.json({ ok: true }, { status: 201, headers: { "X-Custom": "kept" } });

        const { response, json } = await call(handler, bearer());

        expect(response.status).toBe(201);
        expect(response.headers.get("X-Custom")).toBe("kept");
        expect(json).toEqual({ ok: true });
    });
});

describe("scopes", () => {
    it("lets an admin through a scope-gated route", async () => {
        const { response } = await call(echoHandler, bearer(["admin"]), {
            requireScopes: ["admin"],
        });

        expect(response.status).toBe(200);
    });

    it("rejects a valid token that lacks the scope with 403, not 401", async () => {
        const handler = vi.fn(echoHandler);

        const { response, json } = await call(handler, bearer(), { requireScopes: ["admin"] });

        expect(response.status).toBe(403);
        expect(json.code).toBe("AUTHORIZATION_FAILED");
        expect(handler).not.toHaveBeenCalled();
        // A scope failure is not a token failure — telling the client to refresh would loop.
        expect(response.headers.get("X-Token-Status")).toBeNull();
    });

    it("requires every listed scope, not just one of them", async () => {
        const { response } = await call(echoHandler, bearer(["admin"]), {
            requireScopes: ["admin", "billing"],
        });

        expect(response.status).toBe(403);
    });

    it("lets any authenticated user through when no scopes are required", async () => {
        const { response } = await call(echoHandler, bearer());

        expect(response.status).toBe(200);
    });
});

describe("errors raised by the handler", () => {
    /**
     * The `catch` wraps the handler call too, so a route that throws instead of catching still
     * gets the documented status mapping rather than an unhandled rejection.
     */
    it("maps a typed error thrown by the route", async () => {
        const handler: RouteHandler = async () => {
            throw new NotFoundError("Store not found");
        };

        const { response, json } = await call(handler, bearer());

        expect(response.status).toBe(404);
        expect(json.code).toBe("NOT_FOUND");
    });

    it("attributes the error to the authenticated user", async () => {
        const userId = crypto.randomUUID();
        const token = generateAccessToken({
            userId,
            email: "user@example.test",
            scopes: [],
        });
        const handler: RouteHandler = async (req: AuthenticatedRequest) => {
            throw new NotFoundError(`nothing for ${req.auth.sub}`);
        };

        const { json } = await call(handler, { authorization: `Bearer ${token}` });

        expect(json.message).toContain(userId);
    });
});
