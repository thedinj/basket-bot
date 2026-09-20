import { db } from "../../src/lib/db/db";
import { subscribeStoreChanges, type StoreChangeKind } from "../../src/lib/realtime/storeEvents";

export type RecordedStoreEvent = {
    storeId: string;
    kind: StoreChangeKind;
    /** Whether a SQLite transaction was still open when the event fired (it must not be). */
    inTransaction: boolean;
};

/**
 * Listens on the real store-event bus for each of `storeIds` and records what arrives, in order.
 * Call `stop()` (or rely on a fresh process per test file) to unsubscribe.
 *
 * Recording on the bus rather than spying on `publishStoreChange` keeps the assertion about what
 * a stream would actually see, and `inTransaction` pins "publish after commit".
 */
export const recordStoreEvents = (...storeIds: string[]) => {
    const events: RecordedStoreEvent[] = [];
    const unsubscribers = storeIds.map((storeId) =>
        subscribeStoreChanges(storeId, (kind) => {
            events.push({ storeId, kind, inTransaction: db.inTransaction });
        })
    );
    return {
        events,
        /** `[storeId, kind]` pairs, for compact assertions. */
        pairs: () => events.map((event) => [event.storeId, event.kind] as const),
        stop: () => unsubscribers.forEach((unsubscribe) => unsubscribe()),
    };
};
