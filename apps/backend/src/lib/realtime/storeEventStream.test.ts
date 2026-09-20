import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as routeGET } from "../../app/api/stores/[storeId]/events/route";
import {
    seedHousehold,
    seedHouseholdMember,
    seedStore,
    seedUser,
} from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import { generateAccessToken } from "../auth/jwt";
import { withAuth, type AuthenticatedRequest } from "../auth/withAuth";
import { db } from "../db/db";
import * as householdService from "../services/householdService";
import * as storeService from "../services/storeService";
import { createStoreEventsHandler, DEFAULT_HEARTBEAT_MS } from "./storeEventStream";
import { publishStoreChange, storeListenerCount } from "./storeEvents";

/**
 * `GET /api/stores/{storeId}/events`, built the `withAuth.test.ts` way: a real `NextRequest`
 * and the real handler, no Next server. The mobile client parses these bytes, so the frames are
 * asserted verbatim. The heartbeat is shortened through the handler factory so revocation-on-
 * heartbeat can be observed without fake timers fighting the stream's promise plumbing.
 */

const FRAME_READY = "event: ready\ndata: {}\n\n";
const FRAME_ACCESS = "event: access\ndata: {}\n\n";
const FRAME_HEARTBEAT = ": hb\n\n";
const changeFrame = (kind: string) => `event: change\ndata: {"kind":"${kind}"}\n\n`;

type Handler = (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
) => Promise<Response>;

let owner: string;
let stranger: string;
let storeId: string;

beforeEach(() => {
    resetDb();
    owner = seedUser({ name: "Owner" });
    stranger = seedUser({ name: "Stranger" });
    storeId = seedStore({ ownerId: owner });
    // Rejections are logged to the console and the ErrorLog table by design.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

const bearerFor = (userId: string): Record<string, string> => ({
    authorization: `Bearer ${generateAccessToken({ userId, email: "u@example.test", scopes: [] })}`,
});

const open = async (
    options: {
        userId?: string;
        store?: string;
        headers?: Record<string, string>;
        heartbeatMs?: number;
        handler?: Handler;
    } = {}
) => {
    const target = options.store ?? storeId;
    const controller = new AbortController();
    const req = new NextRequest(`https://example.test/api/stores/${target}/events`, {
        method: "GET",
        headers: options.headers ?? bearerFor(options.userId ?? owner),
        signal: controller.signal,
    });
    const handler =
        options.handler ??
        withAuth(createStoreEventsHandler({ heartbeatMs: options.heartbeatMs ?? 60_000 }));
    const response = await handler(req, { params: Promise.resolve({ storeId: target }) });
    return { response, controller };
};

const decoder = new TextDecoder();

/**
 * Reads one SSE frame (up to and including the blank line), or `null` once the stream has ended.
 * Rejects rather than hanging if nothing arrives in time.
 */
const frameReader = (response: Response) => {
    const reader = response.body!.getReader();
    let buffer = "";

    const next = async (timeoutMs = 2000): Promise<string | null> => {
        const deadline = Date.now() + timeoutMs;
        while (!buffer.includes("\n\n")) {
            const remaining = deadline - Date.now();
            let timer: ReturnType<typeof setTimeout> | undefined;
            const chunk = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => reject(new Error(`no frame within ${timeoutMs}ms`)),
                        Math.max(remaining, 0)
                    );
                }),
            ]).finally(() => clearTimeout(timer));
            if (chunk.done) return buffer === "" ? null : buffer;
            buffer += decoder.decode(chunk.value, { stream: true });
        }
        const end = buffer.indexOf("\n\n") + 2;
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end);
        return frame;
    };

    return { next, cancel: () => reader.cancel() };
};

/** A household with the owner and one other member, and a store shared with it. */
const sharedStoreWithMember = () => {
    const member = seedUser({ name: "Member" });
    const householdId = seedHousehold({ ownerId: owner });
    seedHouseholdMember({ householdId, userId: owner });
    seedHouseholdMember({ householdId, userId: member });
    const shared = seedStore({ ownerId: owner, householdId });
    return { member, householdId, shared };
};

describe("opening the stream", () => {
    it("gives the owner a 200 event stream whose first frame is `ready`", async () => {
        const { response, controller } = await open();

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/event-stream");
        expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
        expect(response.headers.get("X-Accel-Buffering")).toBe("no");

        expect(await frameReader(response).next()).toBe(FRAME_READY);
        controller.abort();
    });

    it("is what the route file actually exports", async () => {
        const { response, controller } = await open({ handler: routeGET });

        expect(response.status).toBe(200);
        expect(await frameReader(response).next()).toBe(FRAME_READY);
        controller.abort();
    });

    it("lets a member of the store's household in", async () => {
        const { member, shared } = sharedStoreWithMember();

        const { response, controller } = await open({ userId: member, store: shared });

        expect(response.status).toBe(200);
        controller.abort();
    });

    it("refuses a stranger with a 403 JSON error and subscribes nothing", async () => {
        const { response } = await open({ userId: stranger });

        expect(response.status).toBe(403);
        expect(response.headers.get("Content-Type")).toContain("application/json");
        expect(((await response.json()) as { code: string }).code).toBe("AUTHORIZATION_FAILED");
        expect(storeListenerCount(storeId)).toBe(0);
    });

    it("reports an unknown store as a 404 JSON error", async () => {
        const missing = crypto.randomUUID();
        const { response } = await open({ store: missing });

        expect(response.status).toBe(404);
        expect(((await response.json()) as { code: string }).code).toBe("NOT_FOUND");
        expect(storeListenerCount(missing)).toBe(0);
    });

    it("rejects a missing token with 401 and X-Token-Status so the client refreshes", async () => {
        const { response } = await open({ headers: {}, handler: routeGET });

        expect(response.status).toBe(401);
        expect(response.headers.get("X-Token-Status")).toBe("invalid");
    });

    it("defaults to a 25 second heartbeat", () => {
        expect(DEFAULT_HEARTBEAT_MS).toBe(25_000);
    });
});

describe("events", () => {
    it("forwards a published change as a `change` frame carrying its kind", async () => {
        const { response, controller } = await open();
        const frames = frameReader(response);
        await frames.next();

        publishStoreChange([storeId], "list");
        publishStoreChange([storeId], "layout");

        expect(await frames.next()).toBe(changeFrame("list"));
        expect(await frames.next()).toBe(changeFrame("layout"));
        controller.abort();
    });

    it("does not forward another store's changes", async () => {
        const other = seedStore({ ownerId: owner });
        const { response, controller } = await open({ heartbeatMs: 30 });
        const frames = frameReader(response);
        await frames.next();

        publishStoreChange([other], "list");

        // The next thing to arrive is the heartbeat, not the other store's change.
        expect(await frames.next()).toBe(FRAME_HEARTBEAT);
        controller.abort();
    });

    it("sends a `: hb` comment on the heartbeat interval", async () => {
        const { response, controller } = await open({ heartbeatMs: 20 });
        const frames = frameReader(response);
        await frames.next();

        expect(await frames.next()).toBe(FRAME_HEARTBEAT);
        expect(await frames.next()).toBe(FRAME_HEARTBEAT);
        controller.abort();
    });

    it("forwards an `access` change as a change frame when this user keeps access", async () => {
        const householdId = seedHousehold({ ownerId: owner });
        seedHouseholdMember({ householdId, userId: owner });
        const { response, controller } = await open();
        const frames = frameReader(response);
        await frames.next();

        // Sharing the owner's store changes its audience, not the owner's own access.
        storeService.updateStoreHousehold({ storeId, householdId, userId: owner });

        expect(await frames.next()).toBe(changeFrame("access"));
        controller.abort();
    });
});

describe("closing", () => {
    it("unsubscribes when the client aborts the request", async () => {
        const { response, controller } = await open();
        const frames = frameReader(response);
        await frames.next();
        expect(storeListenerCount(storeId)).toBe(1);

        controller.abort();

        expect(storeListenerCount(storeId)).toBe(0);
        expect(await frames.next()).toBeNull();
    });

    it("unsubscribes when the consumer cancels the body", async () => {
        const { response } = await open();
        const frames = frameReader(response);
        await frames.next();

        await frames.cancel();

        expect(storeListenerCount(storeId)).toBe(0);
    });

    it("sends `access` and closes when the store is deleted", async () => {
        const { response } = await open();
        const frames = frameReader(response);
        await frames.next();

        storeService.deleteStore(storeId, owner);

        expect(await frames.next()).toBe(FRAME_ACCESS);
        expect(await frames.next()).toBeNull();
        expect(storeListenerCount(storeId)).toBe(0);
    });

    it("sends `access` and closes for a member removed from the store's household", async () => {
        const { member, householdId, shared } = sharedStoreWithMember();
        const memberStream = await open({ userId: member, store: shared });
        const ownerStream = await open({ userId: owner, store: shared });
        const memberFrames = frameReader(memberStream.response);
        const ownerFrames = frameReader(ownerStream.response);
        await memberFrames.next();
        await ownerFrames.next();

        householdService.removeMember(householdId, member, owner);

        expect(await memberFrames.next()).toBe(FRAME_ACCESS);
        expect(await memberFrames.next()).toBeNull();
        // The owner still sees the store, so their stream just hears that its audience changed.
        expect(await ownerFrames.next()).toBe(changeFrame("access"));
        expect(storeListenerCount(shared)).toBe(1);
        ownerStream.controller.abort();
    });

    it("sends `access` and closes when the store is unshared from the member's household", async () => {
        const { member, shared } = sharedStoreWithMember();
        const { response } = await open({ userId: member, store: shared });
        const frames = frameReader(response);
        await frames.next();

        storeService.updateStoreHousehold({ storeId: shared, householdId: null, userId: owner });

        expect(await frames.next()).toBe(FRAME_ACCESS);
        expect(await frames.next()).toBeNull();
    });

    it("sends `access` and closes when the member's household is deleted", async () => {
        const { member, householdId, shared } = sharedStoreWithMember();
        const { response } = await open({ userId: member, store: shared });
        const frames = frameReader(response);
        await frames.next();

        householdService.deleteHousehold(householdId, owner);

        expect(await frames.next()).toBe(FRAME_ACCESS);
        expect(await frames.next()).toBeNull();
    });

    it("notices a revocation nobody published, on the next heartbeat", async () => {
        const { member, shared } = sharedStoreWithMember();
        const { response } = await open({ userId: member, store: shared, heartbeatMs: 20 });
        const frames = frameReader(response);
        await frames.next();

        // Straight to the database: no service, so no event.
        db.prepare(`DELETE FROM HouseholdMember WHERE userId = ?`).run(member);

        expect(await frames.next()).toBe(FRAME_ACCESS);
        expect(await frames.next()).toBeNull();
        expect(storeListenerCount(shared)).toBe(0);
    });

    it("closes when the access token expires, so the client reconnects with a fresh one", async () => {
        const handler = createStoreEventsHandler({ heartbeatMs: 60_000 });
        const req = new NextRequest(
            `https://example.test/api/stores/${storeId}/events`
        ) as AuthenticatedRequest;
        const nowSeconds = Date.now() / 1000;
        req.auth = { sub: owner, scopes: [], iat: nowSeconds, exp: nowSeconds + 0.05 };

        const response = await handler(req, { params: Promise.resolve({ storeId }) });
        const frames = frameReader(response);

        expect(await frames.next()).toBe(FRAME_READY);
        expect(await frames.next()).toBeNull();
        expect(storeListenerCount(storeId)).toBe(0);
    });
});
