import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

vi.mock("../utils/secureStorage", () => ({
    KEYS: { ACCESS_TOKEN: "auth_access_token", REFRESH_TOKEN: "auth_refresh_token" },
    secureStorage: {
        get: vi.fn(async () => null),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
    },
}));

vi.mock("../lib/serverReachability", () => ({
    serverReachability: {
        setBaseUrl: vi.fn(),
        reportUnreachable: vi.fn(),
        reportReachable: vi.fn(),
        isUnreachable: vi.fn(() => false),
    },
}));

import { queryKeys } from "../db/queryKeys";
import { ApiError } from "../lib/api/client";
import { DEBOUNCE_MS, FALLBACK_POLL_MS, invalidationsForKind, startStoreSync } from "./storeSync";

const STORE = "store-1";

/** A stream the test drives by hand; `openStream` hands out one per connection attempt. */
const liveBody = () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            controller = c;
        },
    });
    return {
        response: new Response(stream, { status: 200 }),
        send: (text: string) => controller.enqueue(encoder.encode(text)),
    };
};

const READY = "event: ready\ndata: {}\n\n";
const change = (kind: string) => `event: change\ndata: {"kind":"${kind}"}\n\n`;

/** The keys `invalidateQueries` was called with, each as `[key, refetchType]`. */
const invalidated = (spy: MockInstance<QueryClient["invalidateQueries"]>) =>
    spy.mock.calls.map(([filters]) => [filters?.queryKey, filters?.refetchType ?? "active"]);

let queryClient: QueryClient;
let invalidateSpy: MockInstance<QueryClient["invalidateQueries"]>;
let openStream: ReturnType<typeof vi.fn>;

const start = () =>
    startStoreSync(STORE, queryClient, {
        openStream: (path, signal) => openStream(path, signal),
        random: () => 1,
    });

/** Start a sync whose first connection is live and has said `ready` (and flush that resync). */
const startConnected = async () => {
    const body = liveBody();
    openStream.mockResolvedValueOnce(body.response);
    const sync = start();
    await vi.advanceTimersByTimeAsync(0);
    body.send(READY);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    invalidateSpy.mockClear();
    return { sync, body };
};

beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    openStream = vi.fn();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("invalidationsForKind", () => {
    it("list refetches the store's list and marks its store-item caches stale", () => {
        expect(invalidationsForKind(STORE, "list")).toEqual([
            { queryKey: queryKeys.shoppingListItems.byStore(STORE), refetch: true },
            { queryKey: queryKeys.items.byStore(STORE), refetch: false },
            { queryKey: queryKeys.items.withDetails(STORE), refetch: false },
            { queryKey: queryKeys.storeItemSearch.byStore(STORE), refetch: false },
        ]);
    });

    it("layout refetches everything the list groups and labels by", () => {
        expect(invalidationsForKind(STORE, "layout").map((i) => i.queryKey)).toEqual([
            queryKeys.shoppingListItems.byStore(STORE),
            queryKeys.items.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.aisles.byStore(STORE),
            queryKeys.sections.byStore(STORE),
            queryKeys.stores.detail(STORE),
            queryKeys.stores.all(),
        ]);
    });

    it("access refetches the store list", () => {
        expect(invalidationsForKind(STORE, "access").map((i) => i.queryKey)).toEqual([
            queryKeys.stores.all(),
            queryKeys.stores.detail(STORE),
        ]);
    });

    it("resync refetches the list only", () => {
        expect(invalidationsForKind(STORE, "resync").map((i) => i.queryKey)).toEqual([
            queryKeys.shoppingListItems.byStore(STORE),
        ]);
    });
});

describe("startStoreSync", () => {
    it("resyncs the list when the stream becomes ready", async () => {
        const body = liveBody();
        openStream.mockResolvedValueOnce(body.response);
        const sync = start();
        await vi.advanceTimersByTimeAsync(0);
        body.send(READY);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        expect(invalidated(invalidateSpy)).toEqual([
            [queryKeys.shoppingListItems.byStore(STORE), "active"],
        ]);
        sync.stop();
    });

    it("coalesces a burst of changes into one invalidation per key", async () => {
        const { sync, body } = await startConnected();

        body.send(change("list") + change("list") + change("list"));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
        expect(invalidateSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);

        expect(invalidated(invalidateSpy)).toEqual([
            [queryKeys.shoppingListItems.byStore(STORE), "active"],
            [queryKeys.items.byStore(STORE), "none"],
            [queryKeys.items.withDetails(STORE), "none"],
            [queryKeys.storeItemSearch.byStore(STORE), "none"],
        ]);
        sync.stop();
    });

    it("merges kinds, refetching a key when any kind wants it refetched", async () => {
        const { sync, body } = await startConnected();

        body.send(change("list") + change("layout"));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        const calls = invalidated(invalidateSpy);
        expect(calls).toContainEqual([queryKeys.items.byStore(STORE), "active"]);
        expect(calls).toContainEqual([queryKeys.aisles.byStore(STORE), "active"]);
        const listKey = queryKeys.shoppingListItems.byStore(STORE);
        expect(
            calls.filter(([key]) => JSON.stringify(key) === JSON.stringify(listKey))
        ).toHaveLength(1);
        sync.stop();
    });

    it("holds invalidations while a mutation is in flight, then applies them", async () => {
        const { sync, body } = await startConnected();
        const isMutating = vi.spyOn(queryClient, "isMutating").mockReturnValue(1);

        body.send(change("list"));
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 5);
        expect(invalidateSpy).not.toHaveBeenCalled();

        isMutating.mockReturnValue(0);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        expect(invalidated(invalidateSpy)[0]).toEqual([
            queryKeys.shoppingListItems.byStore(STORE),
            "active",
        ]);
        sync.stop();
    });

    it("polls the list while not connected and stops once ready", async () => {
        const body = liveBody();
        openStream
            .mockRejectedValueOnce(new ApiError("down", "NETWORK_ERROR", null, undefined, true))
            .mockResolvedValueOnce(body.response);
        const sync = start();

        await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS + DEBOUNCE_MS);
        expect(invalidated(invalidateSpy)).toEqual([
            [queryKeys.shoppingListItems.byStore(STORE), "active"],
        ]);

        // The reconnect (1 s after the failure) has long since happened; say ready.
        body.send(READY);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        invalidateSpy.mockClear();

        await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS * 3);
        expect(invalidateSpy).not.toHaveBeenCalled();
        sync.stop();
    });

    it("refreshes the store list and stops polling when access is lost", async () => {
        openStream.mockRejectedValue(new ApiError("no", "FORBIDDEN", null, 403));
        const sync = start();

        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
        expect(invalidated(invalidateSpy).map(([key]) => key)).toEqual([
            queryKeys.stores.all(),
            queryKeys.stores.detail(STORE),
        ]);
        invalidateSpy.mockClear();

        await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS * 3);
        expect(invalidateSpy).not.toHaveBeenCalled();
        expect(openStream).toHaveBeenCalledTimes(1);
        sync.stop();
    });

    it("reconnect() opens a new stream whose ready resyncs", async () => {
        const { sync } = await startConnected();
        const next = liveBody();
        openStream.mockResolvedValueOnce(next.response);

        sync.reconnect();
        await vi.advanceTimersByTimeAsync(0);
        expect(openStream).toHaveBeenCalledTimes(2);
        next.send(READY);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

        expect(invalidated(invalidateSpy)).toEqual([
            [queryKeys.shoppingListItems.byStore(STORE), "active"],
        ]);
        sync.stop();
    });

    it("stop() drops pending work and ends the stream", async () => {
        const { sync, body } = await startConnected();

        body.send(change("layout"));
        await vi.advanceTimersByTimeAsync(0);
        sync.stop();
        await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS * 3);

        expect(invalidateSpy).not.toHaveBeenCalled();
        expect(openStream).toHaveBeenCalledTimes(1);
    });
});
