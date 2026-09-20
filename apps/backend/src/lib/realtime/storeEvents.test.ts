import { afterEach, describe, expect, it, vi } from "vitest";
import {
    publishStoreChange,
    storeListenerCount,
    subscribeStoreChanges,
    type StoreChangeKind,
} from "./storeEvents";

/**
 * The bus is the only thing between a write and every phone watching that store. Its contract is
 * small but each clause is load-bearing: de-duplicate (a dispatch into one store fires once),
 * isolate listeners (one broken stream must not starve the others), and never throw into the
 * publisher (the write already committed — the request must still succeed).
 */

afterEach(() => {
    vi.restoreAllMocks();
});

const storeA = "store-a";
const storeB = "store-b";

describe("publish and subscribe", () => {
    it("delivers a change to a subscriber of that store only", () => {
        const onA = vi.fn();
        const onB = vi.fn();
        const stopA = subscribeStoreChanges(storeA, onA);
        const stopB = subscribeStoreChanges(storeB, onB);

        publishStoreChange([storeA], "list");

        expect(onA).toHaveBeenCalledTimes(1);
        expect(onA).toHaveBeenCalledWith("list");
        expect(onB).not.toHaveBeenCalled();
        stopA();
        stopB();
    });

    it("delivers to every subscriber of the store", () => {
        const first = vi.fn();
        const second = vi.fn();
        const stops = [subscribeStoreChanges(storeA, first), subscribeStoreChanges(storeA, second)];

        publishStoreChange([storeA], "layout");

        expect(first).toHaveBeenCalledWith("layout");
        expect(second).toHaveBeenCalledWith("layout");
        stops.forEach((stop) => stop());
    });

    it("stops delivering after unsubscribe, and unsubscribe is idempotent", () => {
        const listener = vi.fn();
        const stop = subscribeStoreChanges(storeA, listener);
        expect(storeListenerCount(storeA)).toBe(1);

        stop();
        stop();
        publishStoreChange([storeA], "list");

        expect(listener).not.toHaveBeenCalled();
        expect(storeListenerCount(storeA)).toBe(0);
    });

    it("de-duplicates store ids and ignores empty ones", () => {
        const onA = vi.fn();
        const onB = vi.fn();
        const stops = [subscribeStoreChanges(storeA, onA), subscribeStoreChanges(storeB, onB)];

        publishStoreChange([storeA, storeB, storeA, "", storeB], "list");

        expect(onA).toHaveBeenCalledTimes(1);
        expect(onB).toHaveBeenCalledTimes(1);
        stops.forEach((stop) => stop());
    });

    it("passes every kind through unchanged", () => {
        const kinds: StoreChangeKind[] = [];
        const stop = subscribeStoreChanges(storeA, (kind) => kinds.push(kind));

        publishStoreChange([storeA], "list");
        publishStoreChange([storeA], "layout");
        publishStoreChange([storeA], "access");

        expect(kinds).toEqual(["list", "layout", "access"]);
        stop();
    });

    it("does nothing when nobody is listening", () => {
        expect(() => publishStoreChange(["nobody-home"], "list")).not.toThrow();
    });
});

describe("failure isolation", () => {
    it("a throwing listener neither breaks the publisher nor the other listeners", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const healthy = vi.fn();
        const stops = [
            subscribeStoreChanges(storeA, () => {
                throw new Error("stream went away");
            }),
            subscribeStoreChanges(storeA, healthy),
        ];

        expect(() => publishStoreChange([storeA], "list")).not.toThrow();
        expect(healthy).toHaveBeenCalledWith("list");
        expect(console.error).toHaveBeenCalled();
        stops.forEach((stop) => stop());
    });

    it("allows more than the EventEmitter default of 10 listeners without warning", () => {
        const warn = vi.spyOn(process, "emitWarning");
        const stops = Array.from({ length: 25 }, () => subscribeStoreChanges(storeA, vi.fn()));

        expect(storeListenerCount(storeA)).toBe(25);
        expect(warn).not.toHaveBeenCalled();
        stops.forEach((stop) => stop());
        expect(storeListenerCount(storeA)).toBe(0);
    });
});

describe("the singleton", () => {
    it("is shared through globalThis so an HMR re-import sees the same subscribers", async () => {
        const listener = vi.fn();
        const stop = subscribeStoreChanges(storeA, listener);

        vi.resetModules();
        const reloaded = await import("./storeEvents");
        reloaded.publishStoreChange([storeA], "list");

        expect(listener).toHaveBeenCalledWith("list");
        stop();
    });
});
