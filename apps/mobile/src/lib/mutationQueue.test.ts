import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The offline queue is the app's last line of defence against losing a user's edit, and its
 * failure modes are quiet ones: a mutation retried forever, a permanent 4xx retried as though the
 * network were at fault, or a queue that silently fails to come back after a restart.
 *
 * Capacitor Preferences is replaced with an in-memory map rather than executed — there is no
 * native bridge in a node test — which also lets a test assert exactly what was persisted.
 */
const storage = new Map<string, string>();

vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        get: vi.fn(async ({ key }: { key: string }) => ({ value: storage.get(key) ?? null })),
        set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
            storage.set(key, value);
        }),
        remove: vi.fn(async ({ key }: { key: string }) => {
            storage.delete(key);
        }),
    },
}));

import { ApiError } from "./api/client";
import { MutationQueue, type QueuedMutation } from "./mutationQueue";

const QUEUE_KEY = "mutation_queue";

const anEdit = (overrides: Partial<QueuedMutation> = {}) => ({
    operation: "update item",
    endpoint: "/api/stores/s1/items/i1",
    method: "PATCH",
    data: { name: "Apples" },
    ...overrides,
});

/** Wait out the constructor's fire-and-forget `loadQueue()`. */
const newQueue = async (): Promise<MutationQueue> => {
    const queue = new MutationQueue();
    await vi.waitFor(() => expect(queue.getQueueSize()).toBeGreaterThanOrEqual(0));
    await Promise.resolve();
    return queue;
};

beforeEach(() => {
    storage.clear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("enqueue", () => {
    it("adds a mutation and persists it", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        expect(queue.getQueueSize()).toBe(1);

        const persisted = JSON.parse(storage.get(QUEUE_KEY)!) as QueuedMutation[];
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject({
            operation: "update item",
            endpoint: "/api/stores/s1/items/i1",
            method: "PATCH",
            retryCount: 0,
        });
        expect(persisted[0].id).toBeTruthy();
        expect(persisted[0].timestamp).toBeGreaterThan(0);
    });

    it("gives each mutation a distinct id", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());
        await queue.enqueue(anEdit());

        const ids = queue.getQueue().map((m) => m.id);
        expect(new Set(ids).size).toBe(2);
    });

    it("notifies subscribers", async () => {
        const queue = await newQueue();
        const listener = vi.fn();
        queue.subscribe(listener);

        await queue.enqueue(anEdit());

        expect(listener).toHaveBeenCalled();
    });

    it("stops notifying after unsubscribe", async () => {
        const queue = await newQueue();
        const listener = vi.fn();
        queue.subscribe(listener)();

        await queue.enqueue(anEdit());

        expect(listener).not.toHaveBeenCalled();
    });
});

describe("persistence across restarts", () => {
    it("reloads a queue written by a previous session", async () => {
        const first = await newQueue();
        await first.enqueue(anEdit({ operation: "first" }));

        const second = await newQueue();
        await vi.waitFor(() => expect(second.getQueueSize()).toBe(1));
        expect(second.getQueue()[0].operation).toBe("first");
    });

    it("starts empty when the stored queue is corrupt", async () => {
        storage.set(QUEUE_KEY, "{not json");

        const queue = await newQueue();

        expect(queue.getQueueSize()).toBe(0);
    });
});

describe("processQueue", () => {
    it("replays mutations in FIFO order and clears them on success", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit({ operation: "first" }));
        await queue.enqueue(anEdit({ operation: "second" }));

        const seen: string[] = [];
        const result = await queue.processQueue(async (m) => {
            seen.push(m.operation);
        });

        expect(seen).toEqual(["first", "second"]);
        expect(result).toEqual({ success: 2, failed: 0 });
        expect(queue.getQueueSize()).toBe(0);
    });

    it("records the retry count and last error on a transient failure", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        await queue.processQueue(async () => {
            throw new Error("network down");
        });

        expect(queue.getQueueSize()).toBe(1);
        expect(queue.getQueue()[0].retryCount).toBe(1);
        expect(queue.getQueue()[0].lastError).toBe("network down");
    });

    /**
     * The runaway-retry guard. Without it a mutation the server will never accept is replayed on
     * every reconnect forever, and the user sees the same failure toast indefinitely.
     */
    it("drops a mutation after MAX_RETRY_COUNT attempts", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        const fail = async () => {
            throw new Error("network down");
        };

        await queue.processQueue(fail);
        expect(queue.getQueueSize()).toBe(1);
        await queue.processQueue(fail);
        expect(queue.getQueueSize()).toBe(1);
        await queue.processQueue(fail);

        expect(queue.getQueueSize()).toBe(0);
    });

    /**
     * A 4xx means the server has judged the request, not that the network failed. Retrying it
     * cannot help, so the queue accepts server state and drops the mutation immediately rather
     * than burning three attempts on it.
     */
    it("drops a permanent 4xx failure on the first attempt", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        const result = await queue.processQueue(async () => {
            throw new ApiError("Not found", "NOT_FOUND", null, 404);
        });

        expect(result).toEqual({ success: 0, failed: 1 });
        expect(queue.getQueueSize()).toBe(0);
    });

    it("keeps retrying a timeout or rate-limit response", async () => {
        for (const status of [408, 429]) {
            storage.clear();
            const queue = await newQueue();
            await queue.enqueue(anEdit());

            await queue.processQueue(async () => {
                throw new ApiError("Retry later", "RETRY", null, status);
            });

            expect(queue.getQueueSize()).toBe(1);
        }
    });

    it("keeps retrying a 5xx response", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        await queue.processQueue(async () => {
            throw new ApiError("Server error", "SERVER", null, 500);
        });

        expect(queue.getQueueSize()).toBe(1);
    });

    it("removes only the mutations that succeeded", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit({ operation: "ok" }));
        await queue.enqueue(anEdit({ operation: "bad" }));

        const result = await queue.processQueue(async (m) => {
            if (m.operation === "bad") throw new Error("network down");
        });

        expect(result).toEqual({ success: 1, failed: 1 });
        expect(queue.getQueue().map((m) => m.operation)).toEqual(["bad"]);
    });

    // Two reconnects landing at once must not replay the same mutation twice.
    it("refuses to run concurrently with itself", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        const first = queue.processQueue(async () => {
            await gate;
        });
        const second = await queue.processQueue(async () => undefined);

        expect(second).toEqual({ success: 0, failed: 0 });
        expect(queue.isProcessingQueue()).toBe(true);

        release();
        await first;
        expect(queue.isProcessingQueue()).toBe(false);
    });

    it("clears the processing flag even when the executor throws", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        await queue.processQueue(async () => {
            throw new Error("network down");
        });

        expect(queue.isProcessingQueue()).toBe(false);
    });
});

describe("manual queue management", () => {
    it("removes a single mutation", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit({ operation: "keep" }));
        await queue.enqueue(anEdit({ operation: "drop" }));

        const target = queue.getQueue().find((m) => m.operation === "drop")!;
        await queue.removeMutation(target.id);

        expect(queue.getQueue().map((m) => m.operation)).toEqual(["keep"]);
    });

    it("clears the whole queue and the stored copy", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        await queue.clearQueue();

        expect(queue.getQueueSize()).toBe(0);
        expect(JSON.parse(storage.get(QUEUE_KEY)!)).toEqual([]);
    });

    // Callers render this list; handing out the live array would let a caller mutate the queue.
    it("hands out a copy of the queue", async () => {
        const queue = await newQueue();
        await queue.enqueue(anEdit());

        const snapshot = queue.getQueue() as QueuedMutation[];
        snapshot.length = 0;

        expect(queue.getQueueSize()).toBe(1);
    });
});
