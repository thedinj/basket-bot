import { NotFoundError } from "@basket-bot/core";
import type { AuthenticatedRequest, RouteHandler } from "../auth/withAuth";
import { toErrorResponse } from "../errors/handleRouteError";
import * as storeService from "../services/storeService";
import { subscribeStoreChanges, type StoreChangeKind } from "./storeEvents";

/**
 * The Server-Sent Events stream behind `GET /api/stores/{storeId}/events`.
 *
 * Wire format (UTF-8, `\n` line endings, a blank line ends a frame):
 * - `event: ready\ndata: {}` — sent first; the client (re)syncs on it.
 * - `event: change\ndata: {"kind":"list"}` — kind is `list` | `layout` | `access`.
 * - `event: access\ndata: {}` — this user can no longer see the store (or it was deleted); the
 *   stream closes right after.
 * - `: hb` — a comment every `heartbeatMs`, which keeps proxies and NATs from idling the
 *   connection out. Access is re-checked on each one.
 *
 * The stream also closes when the access token's `exp` passes, so it can never outlive the token
 * that opened it; the client reconnects with a fresh one.
 */

export const DEFAULT_HEARTBEAT_MS = 25_000;

export const SSE_HEADERS: Readonly<Record<string, string>> = {
    "Content-Type": "text/event-stream",
    // no-transform: keeps a compressing proxy (Caddy `encode gzip`) from holding events back.
    "Cache-Control": "no-cache, no-transform",
    // Tells nginx not to buffer the response.
    "X-Accel-Buffering": "no",
};

const FRAME_READY = "event: ready\ndata: {}\n\n";
const FRAME_ACCESS = "event: access\ndata: {}\n\n";
const FRAME_HEARTBEAT = ": hb\n\n";
const changeFrame = (kind: StoreChangeKind): string =>
    `event: change\ndata: ${JSON.stringify({ kind })}\n\n`;

/** setTimeout's delay is a signed 32-bit int; anything larger fires immediately. */
const MAX_TIMEOUT_MS = 2_147_483_647;

export type StoreEventStreamOptions = {
    storeId: string;
    /** Aborted when the client disconnects. */
    signal: AbortSignal;
    /** Epoch milliseconds at which the stream must close (the token's `exp`). */
    expiresAt: number;
    /** Re-evaluated on each heartbeat and on each "access" event. */
    hasAccess: () => boolean;
    heartbeatMs?: number;
};

/** Builds the event stream for one subscriber. Everything is torn down on abort, cancel or close. */
export function createStoreEventStream(
    options: StoreEventStreamOptions
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

    let closed = false;
    let teardown: () => void = () => {
        closed = true;
    };

    return new ReadableStream<Uint8Array>({
        start(controller) {
            let unsubscribe: () => void = () => undefined;
            const timers: {
                heartbeat?: ReturnType<typeof setInterval>;
                expiry?: ReturnType<typeof setTimeout>;
            } = {};

            const close = (): void => {
                if (closed) return;
                closed = true;
                unsubscribe();
                clearInterval(timers.heartbeat);
                clearTimeout(timers.expiry);
                options.signal.removeEventListener("abort", close);
                try {
                    controller.close();
                } catch {
                    // Already closed or errored by the consumer side.
                }
            };
            teardown = close;

            const send = (frame: string): void => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(frame));
                } catch {
                    close();
                }
            };

            /** Access check that never throws: a transient DB error keeps the stream open. */
            const stillAllowed = (): boolean => {
                try {
                    return options.hasAccess();
                } catch (error) {
                    console.error("[storeEventStream] access re-check failed", {
                        storeId: options.storeId,
                        error,
                    });
                    return true;
                }
            };

            const revoke = (): void => {
                send(FRAME_ACCESS);
                close();
            };

            if (options.signal.aborted) {
                close();
                return;
            }
            options.signal.addEventListener("abort", close);

            send(FRAME_READY);

            unsubscribe = subscribeStoreChanges(options.storeId, (kind) => {
                if (kind === "access" && !stillAllowed()) {
                    revoke();
                    return;
                }
                send(changeFrame(kind));
            });

            timers.heartbeat = setInterval(() => {
                if (!stillAllowed()) {
                    revoke();
                    return;
                }
                send(FRAME_HEARTBEAT);
            }, heartbeatMs);

            const untilExpiry = options.expiresAt - Date.now();
            if (untilExpiry <= 0) {
                close();
            } else {
                timers.expiry = setTimeout(close, Math.min(untilExpiry, MAX_TIMEOUT_MS));
            }
        },
        cancel() {
            teardown();
        },
    });
}

/**
 * The route handler, as a factory so tests can shorten the heartbeat. Access problems surface
 * before any streaming starts, so they are ordinary JSON error responses.
 */
export function createStoreEventsHandler(options: { heartbeatMs?: number } = {}): RouteHandler {
    return async (req: AuthenticatedRequest, { params }) => {
        try {
            const { storeId } = await params;
            const userId = req.auth.sub;

            // Throws AuthorizationError (403) for a store this user can't see.
            const store = storeService.getStoreById(storeId, userId);
            if (!store) {
                throw new NotFoundError("Store not found");
            }

            const stream = createStoreEventStream({
                storeId: store.id,
                signal: req.signal,
                expiresAt: req.auth.exp * 1000,
                hasAccess: () => storeService.userHasAccessToStore(store.id, userId),
                heartbeatMs: options.heartbeatMs,
            });

            return new Response(stream, { status: 200, headers: SSE_HEADERS });
        } catch (error) {
            return toErrorResponse(error, req, { userId: req.auth.sub });
        }
    };
}
