import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for "store X changed" notifications, fanned out to the SSE streams opened by
 * `GET /api/stores/{storeId}/events`.
 *
 * Events carry **no data** — only the store id and what kind of thing changed. Each client
 * refetches through the existing, privacy-filtered GET endpoints, so private list items and
 * per-user reads stay correct without the stream having to know about them.
 *
 * - `"list"`: the store's shopping list changed (add, edit, check, remove, clear, dispatch…).
 * - `"layout"`: something the list groups or labels by changed (items, aisles, sections, name).
 * - `"access"`: who can see the store changed (store deleted, household changed). Each open stream
 *   re-checks its own user's access on this kind and closes itself if it was revoked.
 *
 * Writers call `publishStoreChange` from the service layer **after** the write has committed, with
 * the store id read from the DB row — never the URL's.
 *
 * One process serves the API (`next start` under systemd), so an in-memory emitter is enough.
 */

export type StoreChangeKind = "list" | "layout" | "access";

export type StoreChangeListener = (kind: StoreChangeKind) => void;

const globalForStoreEvents = globalThis as unknown as {
    __storeEvents: EventEmitter | undefined;
};

/**
 * Held on `globalThis` (the `lib/db/db.ts` pattern) so a Next dev HMR reload re-evaluating this
 * module doesn't fork the bus into one that publishers see and one that open streams listen on.
 */
const bus: EventEmitter = (globalForStoreEvents.__storeEvents ??= (() => {
    const emitter = new EventEmitter();
    // One listener per open stream per store; a busy store legitimately exceeds the default 10.
    emitter.setMaxListeners(0);
    return emitter;
})());

const channel = (storeId: string): string => `store:${storeId}`;

/**
 * Notify every open stream for each of `storeIds`. Duplicate and empty ids are ignored.
 *
 * Synchronous and never throws into the caller: the write it reports has already happened, so a
 * failure to notify must not turn a successful request into an error.
 */
export function publishStoreChange(storeIds: readonly string[], kind: StoreChangeKind): void {
    for (const storeId of new Set(storeIds)) {
        if (!storeId) continue;
        try {
            bus.emit(channel(storeId), kind);
        } catch (error) {
            console.error("[storeEvents] publish failed", { storeId, kind, error });
        }
    }
}

/**
 * Listen for changes to one store. Returns an idempotent unsubscribe function.
 *
 * A listener that throws is logged and skipped, so one broken stream can't stop the others (or
 * the publisher) from hearing about the change.
 */
export function subscribeStoreChanges(storeId: string, listener: StoreChangeListener): () => void {
    const wrapped = (kind: StoreChangeKind): void => {
        try {
            listener(kind);
        } catch (error) {
            console.error("[storeEvents] listener failed", { storeId, kind, error });
        }
    };

    bus.on(channel(storeId), wrapped);

    let subscribed = true;
    return () => {
        if (!subscribed) return;
        subscribed = false;
        bus.off(channel(storeId), wrapped);
    };
}

/** Number of live subscriptions for a store. For tests and diagnostics. */
export function storeListenerCount(storeId: string): number {
    return bus.listenerCount(channel(storeId));
}
