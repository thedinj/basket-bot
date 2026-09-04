import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureHarness, harness } from "./testSupport/hookHarness";
import { queryKeys } from "./queryKeys";

/**
 * Rollback is the part of the optimistic-update helper that only runs when something has already
 * gone wrong, which is exactly why it rots unnoticed. A rollback that restores the wrong value —
 * or fails to restore a key that had no data at all — leaves the UI showing a change the server
 * rejected, and the user has no way to tell.
 *
 * The harness supplies a *real* `QueryClient`, so these assertions are about actual cache
 * contents rather than about a mock recording calls.
 */

vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-query")>();
    const { harness: h } = await import("./testSupport/hookHarness");
    return {
        ...actual,
        useQueryClient: () => h.client,
        useMutation: (options: never) => h.register(options),
    };
});

import { QueryClient } from "@tanstack/react-query";
configureHarness(QueryClient);

import { useOptimisticMutation } from "./optimisticUpdates";

const STORE = "store-1";
const KEY = queryKeys.items.byStore(STORE);
const OTHER_KEY = queryKeys.items.withDetails(STORE);

interface Row {
    id: string;
    name: string;
}

const renameTo = (name: string) => (old: unknown) =>
    ((old as Row[] | undefined) ?? []).map((row) => ({ ...row, name }));

beforeEach(() => {
    harness.reset();
});

describe("optimistic application", () => {
    it("writes the optimistic value into the cache before the request resolves", async () => {
        harness.client.setQueryData(KEY, [{ id: "i1", name: "Old" }]);

        let resolveRequest!: () => void;
        const mutation = useOptimisticMutation({
            mutationFn: () => new Promise<void>((resolve) => (resolveRequest = resolve)),
            queryKeys: [KEY],
            updateCache: { queryKey: KEY, updateFn: renameTo("New") },
        });

        const inFlight = mutation.mutateAsync(undefined);
        await vi.waitFor(() =>
            expect((harness.client.getQueryData(KEY) as Row[])[0].name).toBe("New")
        );

        resolveRequest();
        await inFlight;
    });

    it("applies every update when given an array", async () => {
        harness.client.setQueryData(KEY, [{ id: "i1", name: "Old" }]);
        harness.client.setQueryData(OTHER_KEY, [{ id: "i1", name: "Old" }]);

        const mutation = useOptimisticMutation({
            mutationFn: async () => undefined,
            queryKeys: [KEY, OTHER_KEY],
            updateCache: [
                { queryKey: KEY, updateFn: renameTo("New") },
                { queryKey: OTHER_KEY, updateFn: renameTo("New") },
            ],
        });

        await mutation.mutateAsync(undefined);

        expect((harness.client.getQueryData(KEY) as Row[])[0].name).toBe("New");
        expect((harness.client.getQueryData(OTHER_KEY) as Row[])[0].name).toBe("New");
    });

    it("supports the function form, which sees the mutation variables", async () => {
        harness.client.setQueryData(KEY, [{ id: "i1", name: "Old" }]);

        const mutation = useOptimisticMutation<{ name: string }>({
            mutationFn: async () => undefined,
            queryKeys: () => [KEY],
            updateCache: (vars) => ({ queryKey: KEY, updateFn: renameTo(vars.name) }),
        });

        await mutation.mutateAsync({ name: "FromVars" });

        expect((harness.client.getQueryData(KEY) as Row[])[0].name).toBe("FromVars");
    });
});

describe("rollback", () => {
    it("restores the previous value when the request fails", async () => {
        harness.client.setQueryData(KEY, [{ id: "i1", name: "Old" }]);

        const mutation = useOptimisticMutation({
            mutationFn: async () => {
                throw new Error("rejected");
            },
            queryKeys: [KEY],
            updateCache: { queryKey: KEY, updateFn: renameTo("New") },
        });

        await expect(mutation.mutateAsync(undefined)).rejects.toThrow("rejected");

        expect((harness.client.getQueryData(KEY) as Row[])[0].name).toBe("Old");
    });

    /**
     * The subtle one: a key with no cached data snapshots as `undefined`, and the rollback has to
     * put `undefined` back rather than leaving the optimistic value in place. Otherwise a failed
     * mutation *creates* cache data that the server never confirmed.
     */
    it("restores a key that had no data at all", async () => {
        expect(harness.client.getQueryData(KEY)).toBeUndefined();

        const mutation = useOptimisticMutation({
            mutationFn: async () => {
                throw new Error("rejected");
            },
            queryKeys: [KEY],
            updateCache: { queryKey: KEY, updateFn: () => [{ id: "i1", name: "Invented" }] },
        });

        await expect(mutation.mutateAsync(undefined)).rejects.toThrow("rejected");

        expect(harness.client.getQueryData(KEY)).toBeUndefined();
    });

    it("rolls back every key it touched", async () => {
        harness.client.setQueryData(KEY, [{ id: "i1", name: "A" }]);
        harness.client.setQueryData(OTHER_KEY, [{ id: "i1", name: "B" }]);

        const mutation = useOptimisticMutation({
            mutationFn: async () => {
                throw new Error("rejected");
            },
            queryKeys: [KEY, OTHER_KEY],
            updateCache: [
                { queryKey: KEY, updateFn: renameTo("New") },
                { queryKey: OTHER_KEY, updateFn: renameTo("New") },
            ],
        });

        await expect(mutation.mutateAsync(undefined)).rejects.toThrow();

        expect((harness.client.getQueryData(KEY) as Row[])[0].name).toBe("A");
        expect((harness.client.getQueryData(OTHER_KEY) as Row[])[0].name).toBe("B");
    });

    it("still calls the caller's onError", async () => {
        const onError = vi.fn();
        const mutation = useOptimisticMutation({
            mutationFn: async () => {
                throw new Error("rejected");
            },
            queryKeys: [KEY],
            updateCache: { queryKey: KEY, updateFn: renameTo("New") },
            onError,
        });

        await expect(mutation.mutateAsync(undefined)).rejects.toThrow();

        expect(onError).toHaveBeenCalledOnce();
    });
});

describe("settled invalidation", () => {
    it("invalidates the configured keys on success", async () => {
        const mutation = useOptimisticMutation({
            mutationFn: async () => undefined,
            queryKeys: [KEY, OTHER_KEY],
            updateCache: { queryKey: KEY, updateFn: renameTo("New") },
        });

        await mutation.mutateAsync(undefined);

        expect(harness.invalidatedIn("settled")).toEqual(
            [JSON.stringify(KEY), JSON.stringify(OTHER_KEY)].sort()
        );
    });

    /**
     * Also on failure. After a rollback the cache holds a value that was never re-checked against
     * the server, so the refetch is what restores eventual consistency.
     */
    it("invalidates the configured keys on failure too", async () => {
        const mutation = useOptimisticMutation({
            mutationFn: async () => {
                throw new Error("rejected");
            },
            queryKeys: [KEY],
            updateCache: { queryKey: KEY, updateFn: renameTo("New") },
            onError: () => undefined,
        });

        await expect(mutation.mutateAsync(undefined)).rejects.toThrow();

        expect(harness.invalidatedIn("settled")).toEqual([JSON.stringify(KEY)]);
    });

    // The onMutate pass is a subscriber-notification hack (`refetchType: "none"`), not part of the
    // cascade. Keeping the two distinguishable is what makes cacheCascade.test.ts meaningful.
    it("keeps the notification pass separate from the real cascade", async () => {
        const mutation = useOptimisticMutation({
            mutationFn: async () => undefined,
            queryKeys: [KEY],
            updateCache: { queryKey: KEY, updateFn: renameTo("New") },
        });

        await mutation.mutateAsync(undefined);

        const notify = harness.calls.filter(
            (c) => c.phase === "mutate" && c.method === "invalidateQueries"
        );
        expect(notify).toHaveLength(1);
        expect(notify[0].refetchType).toBe("none");
    });
});
