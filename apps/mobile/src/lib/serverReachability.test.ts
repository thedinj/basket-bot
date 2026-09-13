import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerReachability } from "./serverReachability";

/**
 * Reachability is what keeps a backend outage from being mistaken for a logged-out session,
 * so its failure modes are the expensive kind: a probe loop that never recovers leaves the
 * user staring at a retry screen after the server is back, and one that stacks timers hammers
 * a server that is already struggling.
 *
 * `fetch` is stubbed and timers are faked so the backoff schedule can be asserted exactly
 * rather than waited out.
 */

const okResponse = () => ({ ok: true, status: 200 }) as Response;
const badGateway = () => ({ ok: false, status: 502 }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;

const newReachability = (): ServerReachability => {
    const reachability = new ServerReachability();
    reachability.setBaseUrl("https://example.test");
    return reachability;
};

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("reporting", () => {
    it("starts out reachable", () => {
        const reachability = newReachability();
        expect(reachability.getState()).toBe("ok");
        expect(reachability.isUnreachable()).toBe(false);
        expect(reachability.getNextProbeAt()).toBeNull();
    });

    it("flips to unreachable and notifies subscribers", () => {
        const reachability = newReachability();
        const listener = vi.fn();
        reachability.subscribe(listener);

        reachability.reportUnreachable();

        expect(reachability.isUnreachable()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not stack probe loops when failures repeat", () => {
        const reachability = newReachability();
        const listener = vi.fn();
        reachability.subscribe(listener);

        reachability.reportUnreachable();
        const firstProbeAt = reachability.getNextProbeAt();
        reachability.reportUnreachable();
        reachability.reportUnreachable();

        // Every failing request reports, but only the first one schedules anything.
        expect(listener).toHaveBeenCalledTimes(1);
        expect(reachability.getNextProbeAt()).toBe(firstProbeAt);
    });

    it("schedules the first probe 2s out", () => {
        const reachability = newReachability();
        const start = Date.now();

        reachability.reportUnreachable();

        expect(reachability.getNextProbeAt()).toBe(start + 2000);
    });
});

describe("probe backoff", () => {
    it("backs off 2s, 4s, 8s, 15s, 30s and clamps at 60s", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        const reachability = newReachability();
        reachability.reportUnreachable();

        const expectedDelays = [2000, 4000, 8000, 15000, 30000, 60000, 60000];

        for (const delay of expectedDelays) {
            const scheduledFor = reachability.getNextProbeAt();
            expect(scheduledFor).toBe(Date.now() + delay);

            await vi.advanceTimersByTimeAsync(delay);
        }

        expect(reachability.isUnreachable()).toBe(true);
    });

    it("recovers when a probe succeeds, and stops probing", async () => {
        fetchMock.mockResolvedValue(okResponse());
        const reachability = newReachability();
        const listener = vi.fn();
        reachability.subscribe(listener);

        reachability.reportUnreachable();
        await vi.advanceTimersByTimeAsync(2000);

        expect(reachability.isUnreachable()).toBe(false);
        expect(reachability.getNextProbeAt()).toBeNull();

        // Nothing further is scheduled once we're back.
        const callsAfterRecovery = fetchMock.mock.calls.length;
        await vi.advanceTimersByTimeAsync(120000);
        expect(fetchMock).toHaveBeenCalledTimes(callsAfterRecovery);
    });

    it("treats a non-ok health response as still down", async () => {
        fetchMock.mockResolvedValue(badGateway());
        const reachability = newReachability();
        reachability.reportUnreachable();

        await vi.advanceTimersByTimeAsync(2000);

        expect(reachability.isUnreachable()).toBe(true);
        expect(reachability.getNextProbeAt()).toBe(Date.now() + 4000);
    });

    it("probes the health endpoint on the configured base URL", async () => {
        fetchMock.mockResolvedValue(okResponse());
        const reachability = newReachability();
        reachability.reportUnreachable();

        await vi.advanceTimersByTimeAsync(2000);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://example.test/api/health",
            expect.objectContaining({ method: "GET" })
        );
    });
});

describe("probeNow", () => {
    it("probes immediately and resets the backoff", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        const reachability = newReachability();
        reachability.reportUnreachable();

        // Burn through a few failures so the delay has grown.
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(4000);
        expect(reachability.getNextProbeAt()).toBe(Date.now() + 8000);

        fetchMock.mockResolvedValue(okResponse());
        await expect(reachability.probeNow()).resolves.toBe(true);

        expect(reachability.isUnreachable()).toBe(false);
    });

    it("restarts the ladder when the manual probe also fails", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        const reachability = newReachability();
        reachability.reportUnreachable();

        // Three failures in: the next automatic probe would otherwise be 15s out.
        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(4000);
        await vi.advanceTimersByTimeAsync(8000);
        expect(reachability.getNextProbeAt()).toBe(Date.now() + 15000);

        await expect(reachability.probeNow()).resolves.toBe(false);

        // Tapping retry puts us back at the top of the ladder rather than leaving the user
        // on a long wait they just tried to skip.
        expect(reachability.getNextProbeAt()).toBe(Date.now() + 4000);
    });
});

describe("reportReachable", () => {
    it("clears a pending probe loop when an ordinary request succeeds", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        const reachability = newReachability();
        const listener = vi.fn();
        reachability.subscribe(listener);

        reachability.reportUnreachable();
        listener.mockClear();

        // A real request got through before the next probe was due.
        reachability.reportReachable();

        expect(reachability.isUnreachable()).toBe(false);
        expect(reachability.getNextProbeAt()).toBeNull();
        expect(listener).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(120000);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("is quiet when nothing was wrong", () => {
        const reachability = newReachability();
        const listener = vi.fn();
        reachability.subscribe(listener);

        reachability.reportReachable();
        reachability.reportReachable();

        // Every successful request calls this; it must not wake subscribers each time.
        expect(listener).not.toHaveBeenCalled();
    });
});

describe("subscribe", () => {
    it("stops notifying after unsubscribe", () => {
        const reachability = newReachability();
        const listener = vi.fn();

        const unsubscribe = reachability.subscribe(listener);
        unsubscribe();
        reachability.reportUnreachable();

        expect(listener).not.toHaveBeenCalled();
    });
});
