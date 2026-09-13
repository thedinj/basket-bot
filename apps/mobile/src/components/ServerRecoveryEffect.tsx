import { App as CapacitorApp } from "@capacitor/app";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "../auth/useAuth";
import { useSync } from "../hooks/useRefreshAndSync";
import { mutationQueue } from "../lib/mutationQueue";
import { serverReachability } from "../lib/serverReachability";

/**
 * Brings the app back up the moment the backend returns: replays anything queued during the
 * outage, then refetches.
 *
 * Both halves matter. Without the replay, edits made during an outage sit in the queue until
 * the user happens to find the sync button — they look applied on screen but never reached
 * the server. Without the refetch, queries that failed during the outage stay in their error
 * state, so the user would be told we're back while still looking at nothing.
 *
 * Also re-probes when the app returns to the foreground, so a phone unlocked hours later
 * reconnects at once rather than waiting out the 60s backoff.
 *
 * Renders nothing.
 */
const ServerRecoveryEffect: React.FC = () => {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const { sync } = useSync();
    const wasUnreachable = useRef(serverReachability.isUnreachable());

    // Read through refs so the subscription below doesn't need to be torn down and rebuilt
    // every time auth state or the sync callback identity changes.
    const isAuthenticatedRef = useRef(isAuthenticated);
    const syncRef = useRef(sync);
    isAuthenticatedRef.current = isAuthenticated;
    syncRef.current = sync;

    useEffect(() => {
        return serverReachability.subscribe(() => {
            const isUnreachable = serverReachability.isUnreachable();
            const recovered = wasUnreachable.current && !isUnreachable;
            wasUnreachable.current = isUnreachable;

            if (!recovered) {
                return;
            }

            void (async () => {
                // Replaying while signed out would send every queued write without a token;
                // the 401s count as permanent failures and the queue would drop them.
                if (isAuthenticatedRef.current && mutationQueue.getQueueSize() > 0) {
                    await syncRef.current();
                }

                await queryClient.invalidateQueries();
            })();
        });
    }, [queryClient]);

    useEffect(() => {
        const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
            if (isActive && serverReachability.isUnreachable()) {
                serverReachability.probeNow();
            }
        });

        return () => {
            listener.then((handle) => handle.remove());
        };
    }, []);

    return null;
};

export default ServerRecoveryEffect;
