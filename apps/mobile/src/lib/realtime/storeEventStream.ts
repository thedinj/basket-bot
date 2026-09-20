import { z } from "zod";
import { apiClient, ApiError } from "../api/client";

/**
 * Live "this store changed" notifications over server-sent events
 * (`GET /api/stores/{storeId}/events`).
 *
 * Events carry no data — only which kind of thing changed — and the caller refetches through
 * the ordinary GETs, so privacy filtering and per-user fields stay the server's job. Plain TS
 * with no React, so the parsing and reconnect policy are unit-testable in the node test env;
 * `realtime/useStoreEvents.ts` is the React side.
 *
 * `fetch` rather than `EventSource`, because `EventSource` cannot send an `Authorization`
 * header and the token must not go in the query string.
 */

/** Wire payload of an `event: change` frame. */
export const storeChangeEventSchema = z.object({
    kind: z.enum(["list", "layout", "access"]),
});

export type StoreChangeKind = z.infer<typeof storeChangeEventSchema>["kind"];

/** One dispatched SSE frame. `event` defaults to `"message"`, as in the SSE spec. */
export type SseFrame = { event: string; data: string };

/**
 * Incremental SSE parser. Chunks may split anywhere — mid-line, mid-`\r\n`, mid-frame — so
 * partial lines are buffered until their terminator arrives. Multiple `data:` lines join with
 * `\n`; comment lines (`:` — the server's heartbeats) and unknown fields are ignored; a blank
 * line dispatches the frame.
 */
export const createSseParser = (onFrame: (frame: SseFrame) => void) => {
    let buffer = "";
    let eventName = "";
    let dataLines: string[] = [];
    let hasField = false;

    const dispatch = () => {
        if (hasField) {
            onFrame({ event: eventName || "message", data: dataLines.join("\n") });
        }
        eventName = "";
        dataLines = [];
        hasField = false;
    };

    const processLine = (line: string) => {
        if (line === "") {
            dispatch();
            return;
        }
        if (line.startsWith(":")) {
            return;
        }
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) {
            value = value.slice(1);
        }
        if (field === "event") {
            eventName = value;
            hasField = true;
        } else if (field === "data") {
            dataLines.push(value);
            hasField = true;
        }
    };

    return {
        push(chunk: string) {
            buffer += chunk;
            for (;;) {
                const match = /\r\n|\r|\n/.exec(buffer);
                if (!match) {
                    break;
                }
                // A lone trailing `\r` may be the first half of a `\r\n` split across chunks.
                if (match[0] === "\r" && match.index === buffer.length - 1) {
                    break;
                }
                processLine(buffer.slice(0, match.index));
                buffer = buffer.slice(match.index + match[0].length);
            }
        },
        /** End of stream: a trailing `\r` still ends its line; an unterminated frame is dropped. */
        end() {
            if (buffer.endsWith("\r")) {
                processLine(buffer.slice(0, -1));
            }
            buffer = "";
            eventName = "";
            dataLines = [];
            hasField = false;
        },
    };
};

/**
 * Read an SSE body to its end, calling `onFrame` per frame and `onActivity` for every chunk
 * (heartbeats included). Resolves when the server closes the stream or `signal` aborts.
 */
export const readSseStream = async (
    body: ReadableStream<Uint8Array>,
    onFrame: (frame: SseFrame) => void,
    signal: AbortSignal,
    onActivity: () => void = () => {}
): Promise<void> => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser(onFrame);
    // Cancelling the reader is what unblocks a pending `read()`; aborting the fetch alone
    // does not reach a body that is already being consumed on every platform.
    const cancel = () => {
        reader.cancel().catch(() => {});
    };
    if (signal.aborted) {
        cancel();
    } else {
        signal.addEventListener("abort", cancel, { once: true });
    }

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done || signal.aborted) {
                break;
            }
            onActivity();
            parser.push(decoder.decode(value, { stream: true }));
        }
        parser.end();
    } finally {
        signal.removeEventListener("abort", cancel);
        reader.releaseLock();
    }
};

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Heartbeats arrive every 25 s. Past this much silence the socket is presumed dead — a
 * phone that changed networks can hold a half-open connection indefinitely — and is replaced.
 */
export const SILENCE_TIMEOUT_MS = 60_000;

/**
 * Delay before reconnect attempt `attempt` (0-based): 1 s doubling to a 30 s cap, scaled into
 * [75 %, 100 %] of that by `random` so a server restart doesn't get every phone back at once.
 */
export const backoffDelay = (attempt: number, random: () => number = Math.random): number => {
    const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** attempt);
    return Math.round(base * (0.75 + 0.25 * random()));
};

export type StoreEventHandlers = {
    /** A change was published for this store. */
    onChange: (kind: StoreChangeKind) => void;
    /** Connected (`event: ready`) — first time or after a reconnect; anything may have been missed. */
    onResync: () => void;
    /**
     * The user can no longer see this store (`event: access`, 403, or 404) or their session is
     * over. The stream has stopped for good; nothing will reconnect it.
     */
    onAccessLost: () => void;
    /** Live (`true` once `ready` arrives) or not (dropped, reconnecting, stopped). */
    onConnectionChange?: (connected: boolean) => void;
};

export type StoreEventStreamOptions = {
    /** Defaults to `apiClient.openStream`. */
    openStream?: (path: string, signal: AbortSignal) => Promise<Response>;
    random?: () => number;
};

export type StoreEventStream = {
    /** Stop for good. Idempotent. */
    close: () => void;
    /**
     * Drop the current connection (if any) and connect again now, with the backoff reset.
     * For app resume, where the OS may have killed the socket without either side noticing.
     */
    reconnect: () => void;
};

/** An error after which retrying cannot help: the store is gone, forbidden, or the session is. */
const isFatal = (error: unknown): boolean =>
    error instanceof ApiError &&
    !error.isNetworkError &&
    (error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        // The refresh token itself was refused (no HTTP status is attached to that error).
        (error.status === undefined && error.tokenStatus === "invalid"));

export const connectStoreEvents = (
    storeId: string,
    handlers: StoreEventHandlers,
    options: StoreEventStreamOptions = {}
): StoreEventStream => {
    const openStream =
        options.openStream ??
        ((path: string, signal: AbortSignal) => apiClient.openStream(path, signal));
    const random = options.random ?? Math.random;
    const path = `/api/stores/${encodeURIComponent(storeId)}/events`;

    let stopped = false;
    let attempt = 0;
    let connected = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const setConnected = (value: boolean) => {
        if (connected !== value) {
            connected = value;
            handlers.onConnectionChange?.(value);
        }
    };

    const clearTimers = () => {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }
    };

    const stop = () => {
        stopped = true;
        clearTimers();
        controller?.abort();
        controller = null;
        setConnected(false);
    };

    const scheduleRetry = () => {
        if (stopped || retryTimer) {
            return;
        }
        const delay = backoffDelay(attempt, random);
        attempt += 1;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            start();
        }, delay);
    };

    const start = () => {
        if (stopped) {
            return;
        }
        const current = new AbortController();
        controller = current;
        const isCurrent = () => !stopped && controller === current;

        const armSilenceTimer = () => {
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            // Aborting ends the read loop below like a server close, which reconnects.
            silenceTimer = setTimeout(() => current.abort(), SILENCE_TIMEOUT_MS);
        };

        const onFrame = (frame: SseFrame) => {
            if (!isCurrent()) {
                return;
            }
            if (frame.event === "ready") {
                attempt = 0;
                setConnected(true);
                handlers.onResync();
            } else if (frame.event === "change") {
                const parsed = storeChangeEventSchema.safeParse(safeJson(frame.data));
                if (parsed.success) {
                    handlers.onChange(parsed.data.kind);
                }
            } else if (frame.event === "access") {
                stop();
                handlers.onAccessLost();
            }
        };

        void (async () => {
            try {
                // Armed before connecting too: `openStream` has no timeout of its own.
                armSilenceTimer();
                const response = await openStream(path, current.signal);
                if (!isCurrent()) {
                    current.abort();
                    return;
                }
                if (!response.body) {
                    throw new Error("Event stream response has no body");
                }
                await readSseStream(response.body, onFrame, current.signal, armSilenceTimer);
            } catch (error: unknown) {
                if (!isCurrent()) {
                    return;
                }
                if (isFatal(error)) {
                    stop();
                    handlers.onAccessLost();
                    return;
                }
            }

            if (!isCurrent()) {
                return;
            }
            // The stream ended: server close (JWT expiry, restart), silence timeout, or a
            // failed connect. Reconnect after the backoff.
            if (silenceTimer) {
                clearTimeout(silenceTimer);
                silenceTimer = null;
            }
            controller = null;
            setConnected(false);
            scheduleRetry();
        })();
    };

    start();

    return {
        close: stop,
        reconnect: () => {
            if (stopped) {
                return;
            }
            clearTimers();
            const previous = controller;
            controller = null;
            previous?.abort();
            setConnected(false);
            attempt = 0;
            start();
        },
    };
};

const safeJson = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
};
