import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../db/queryKeys";
import { interactionGate, MAX_INTERACTION_HOLD_MS } from "../utils/interactionGate";
import {
    connectStoreEvents,
    type StoreChangeKind,
    type StoreEventStream,
    type StoreEventStreamOptions,
} from "../lib/realtime/storeEventStream";

/**
 * Turns a store's server-pushed change events into cache invalidations. React-free so it can
 * be tested with a real `QueryClient` in the node env; `useStoreEvents` only mounts it.
 *
 * Policy (keep `docs/CACHE_KEYS.md` § "Server-pushed invalidation" in step):
 * - Events are coalesced per store for `DEBOUNCE_MS`, so someone checking off five items in
 *   a row costs one refetch, not five.
 * - Nothing is invalidated while any mutation is in flight: a refetch landing mid-mutation
 *   would overwrite that mutation's optimistic update with pre-write server data. The pending
 *   invalidation is held (re-checked every `DEBOUNCE_MS`) until mutations settle.
 * - Nothing is invalidated while a finger is on the screen either (`interactionGate`), so a
 *   remote change can't move a row out from under a tap that is already being aimed. That
 *   hold is capped at `MAX_INTERACTION_HOLD_MS`, after which the update goes in regardless —
 *   a list being worked continuously must still catch up eventually.
 * - Every `ready` (connect or reconnect) resyncs the list, since events may have been missed.
 * - While not connected, the list is refetched every `FALLBACK_POLL_MS` so a blocked or
 *   unsupported stream degrades to polling rather than to nothing.
 */

export const DEBOUNCE_MS = 300;
export const FALLBACK_POLL_MS = 20_000;

/** Which cache keys a change of each kind makes stale. `refetch: false` only marks them stale. */
type Invalidation = { queryKey: unknown[]; refetch: boolean };

export const invalidationsForKind = (
    storeId: string,
    kind: StoreChangeKind | "resync"
): Invalidation[] => {
    const refetch = (queryKey: unknown[]): Invalidation => ({ queryKey, refetch: true });
    const markStale = (queryKey: unknown[]): Invalidation => ({ queryKey, refetch: false });

    switch (kind) {
        case "resync":
            return [refetch(queryKeys.shoppingListItems.byStore(storeId))];
        case "list":
            // A list upsert can create a store item, so the item caches are stale too — but
            // they are only marked, not refetched: most list events are check-offs, and the
            // item caches only matter on the next autocomplete or duplicate check.
            return [
                refetch(queryKeys.shoppingListItems.byStore(storeId)),
                markStale(queryKeys.items.byStore(storeId)),
                markStale(queryKeys.items.withDetails(storeId)),
                markStale(queryKeys.storeItemSearch.byStore(storeId)),
            ];
        case "layout":
            return [
                refetch(queryKeys.shoppingListItems.byStore(storeId)),
                refetch(queryKeys.items.byStore(storeId)),
                refetch(queryKeys.items.withDetails(storeId)),
                refetch(queryKeys.aisles.byStore(storeId)),
                refetch(queryKeys.sections.byStore(storeId)),
                // Store rename.
                refetch(queryKeys.stores.detail(storeId)),
                refetch(queryKeys.stores.all()),
            ];
        case "access":
            return [refetch(queryKeys.stores.all()), refetch(queryKeys.stores.detail(storeId))];
    }
};

export type StoreSync = {
    /** Reconnect now and resync — for app resume. */
    reconnect: () => void;
    stop: () => void;
};

export type StoreSyncOptions = {
    /** Defaults to the shared `interactionGate`. */
    isInteracting?: () => boolean;
    now?: () => number;
};

export const startStoreSync = (
    storeId: string,
    queryClient: QueryClient,
    streamOptions?: StoreEventStreamOptions,
    syncOptions: StoreSyncOptions = {}
): StoreSync => {
    const isInteracting = syncOptions.isInteracting ?? (() => interactionGate.isActive());
    const now = syncOptions.now ?? (() => Date.now());

    let stopped = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    // When the current batch was first held back by a touch, for the cap. Null when nothing
    // is being held.
    let heldSince: number | null = null;
    // Kinds awaiting the debounce; "resync" is the list refetch alone.
    const pending = new Set<StoreChangeKind | "resync">();

    const flush = () => {
        debounceTimer = null;
        if (stopped || pending.size === 0) {
            return;
        }
        if (queryClient.isMutating() > 0) {
            schedule();
            return;
        }
        if (isInteracting()) {
            const at = now();
            heldSince ??= at;
            if (at - heldSince < MAX_INTERACTION_HOLD_MS) {
                schedule();
                return;
            }
        }
        heldSince = null;

        // Merge by key so a key named by two kinds is invalidated once, refetching if either
        // kind wants it refetched.
        const byKey = new Map<string, Invalidation>();
        for (const kind of pending) {
            for (const inv of invalidationsForKind(storeId, kind)) {
                const id = JSON.stringify(inv.queryKey);
                const existing = byKey.get(id);
                byKey.set(
                    id,
                    existing ? { ...inv, refetch: existing.refetch || inv.refetch } : inv
                );
            }
        }
        pending.clear();

        for (const { queryKey, refetch } of byKey.values()) {
            void queryClient.invalidateQueries({
                queryKey,
                ...(refetch ? {} : { refetchType: "none" as const }),
            });
        }
    };

    const schedule = () => {
        if (!stopped && !debounceTimer) {
            debounceTimer = setTimeout(flush, DEBOUNCE_MS);
        }
    };

    const enqueue = (kind: StoreChangeKind | "resync") => {
        pending.add(kind);
        schedule();
    };

    const startPolling = () => {
        if (!stopped && !pollTimer) {
            pollTimer = setInterval(() => enqueue("resync"), FALLBACK_POLL_MS);
        }
    };

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    const stream: StoreEventStream = connectStoreEvents(
        storeId,
        {
            onChange: enqueue,
            onResync: () => enqueue("resync"),
            onAccessLost: () => {
                // The stream is over for good; polling a store we can't read would only 403.
                stopPolling();
                enqueue("access");
            },
            onConnectionChange: (connected) => {
                if (connected) {
                    stopPolling();
                } else {
                    startPolling();
                }
            },
        },
        streamOptions
    );

    // Not connected until the first `ready`.
    startPolling();

    return {
        reconnect: () => {
            if (!stopped) {
                // The `ready` that follows resyncs.
                stream.reconnect();
            }
        },
        stop: () => {
            stopped = true;
            stream.close();
            stopPolling();
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            pending.clear();
        },
    };
};
