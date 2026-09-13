/**
 * Tracks whether the backend is reachable, independently of whether the device has a
 * network connection.
 *
 * These are different failures and the app has to tell them apart. `useNetworkStatus`
 * (TanStack's `onlineManager`) only reports the device's radio state — a phone on Wi-Fi
 * with a dead server reports "online". Treating an unreachable server as an auth failure
 * is what used to strand the user on a login page that could not work, so reachability
 * gets its own state.
 *
 * A singleton with a listener set rather than a React context, because the writer is
 * `ApiClient` — constructed at module scope, outside the tree, with no access to hooks.
 * Same shape as `mutationQueue` and `clientErrorLog`. Read it from React with
 * `useServerReachability`.
 */

export type ReachabilityState = "ok" | "unreachable";

/**
 * Backoff between health probes while the server is down. Clamped to the last entry, so
 * a long outage settles into a probe a minute rather than giving up — the app is expected
 * to recover on its own once the backend returns, with no user action.
 */
const PROBE_DELAYS_MS = [2000, 4000, 8000, 15000, 30000, 60000];

/**
 * Probes are a liveness check, not a data fetch: fail fast rather than hold a socket open
 * for the full request timeout.
 */
const PROBE_TIMEOUT_MS = 5000;

const HEALTH_ENDPOINT = "/api/health";

export class ServerReachability {
    private state: ReachabilityState = "ok";
    private listeners: Set<() => void> = new Set();
    private probeTimer: ReturnType<typeof setTimeout> | null = null;
    private attempt = 0;
    private nextProbeAt: number | null = null;
    private baseUrl = "";
    private probeInFlight: Promise<boolean> | null = null;

    /**
     * Kept in step with `apiClient.setBaseUrl()` so a probe hits the same host the app's
     * requests do, including a user-configured `remote_api_url`.
     */
    setBaseUrl(url: string): void {
        this.baseUrl = url;
    }

    getState(): ReachabilityState {
        return this.state;
    }

    isUnreachable(): boolean {
        return this.state === "unreachable";
    }

    /** Epoch ms of the next scheduled probe, or null when no probe is pending. */
    getNextProbeAt(): number | null {
        return this.nextProbeAt;
    }

    /**
     * Reported by `ApiClient` for any failure that means "the server did not answer" —
     * a connection error, a timeout, or a 502/503/504 from the reverse proxy.
     * Idempotent: repeated failures while already down must not stack probe loops.
     */
    reportUnreachable(): void {
        if (this.state === "unreachable") {
            return;
        }

        this.state = "unreachable";
        this.attempt = 0;
        this.scheduleProbe();
        this.notifyListeners();
    }

    /** Reported by `ApiClient` on any successful response — the server is demonstrably up. */
    reportReachable(): void {
        if (this.state === "ok" && this.probeTimer === null) {
            return;
        }

        this.clearProbeTimer();
        this.attempt = 0;

        const wasUnreachable = this.state === "unreachable";
        this.state = "ok";

        if (wasUnreachable) {
            this.notifyListeners();
        }
    }

    /**
     * Probe immediately and reset the backoff. Used by the "Retry now" button and by the
     * app-resume listener, so a phone unlocked hours later reconnects at once instead of
     * waiting out a 60s delay.
     */
    async probeNow(): Promise<boolean> {
        this.clearProbeTimer();
        this.attempt = 0;
        return this.probe();
    }

    /**
     * One health request. Deliberately a bare `fetch` rather than `apiClient.request` —
     * going through the client would report its own failures back here (recursing) and
     * would block on the auth-ready promise, which is exactly what a probe must not do.
     */
    private async probe(): Promise<boolean> {
        if (this.probeInFlight) {
            return this.probeInFlight;
        }

        const inFlight = (async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

            try {
                const response = await fetch(`${this.baseUrl}${HEALTH_ENDPOINT}`, {
                    method: "GET",
                    signal: controller.signal,
                });

                if (response.ok) {
                    this.reportReachable();
                    return true;
                }
            } catch {
                // Any throw means the server still isn't answering; fall through to reschedule.
            } finally {
                clearTimeout(timeoutId);
                this.probeInFlight = null;
            }

            if (this.state === "unreachable") {
                this.attempt++;
                this.scheduleProbe();
                this.notifyListeners();
            }

            return false;
        })();

        this.probeInFlight = inFlight;
        return inFlight;
    }

    private scheduleProbe(): void {
        this.clearProbeTimer();

        const delay = PROBE_DELAYS_MS[Math.min(this.attempt, PROBE_DELAYS_MS.length - 1)];
        this.nextProbeAt = Date.now() + delay;
        this.probeTimer = setTimeout(() => {
            this.probeTimer = null;
            this.probe();
        }, delay);
    }

    private clearProbeTimer(): void {
        if (this.probeTimer !== null) {
            clearTimeout(this.probeTimer);
            this.probeTimer = null;
        }
        this.nextProbeAt = null;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener());
    }
}

// Singleton instance
export const serverReachability = new ServerReachability();
