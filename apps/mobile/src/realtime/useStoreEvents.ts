import { App as CapacitorApp } from "@capacitor/app";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { startStoreSync } from "./storeSync";

/**
 * Keeps `storeId`'s shopping list live: while mounted (and `enabled`), holds the store's
 * server-sent event stream open and invalidates the affected caches when someone else changes
 * the store. All policy lives in `startStoreSync`; this only ties it to the component
 * lifecycle and to app resume.
 *
 * Never suspends and renders nothing, so it is safe at the top of a tab shell. A new
 * `storeId` tears the old stream down and opens one for the new store.
 */
export const useStoreEvents = (storeId: string, enabled: boolean): void => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!enabled || !storeId) {
            return;
        }

        const sync = startStoreSync(storeId, queryClient);

        // Android drops sockets while the app is backgrounded, often without either end
        // noticing — reconnect (and so resync) on every return to the foreground.
        const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
            if (isActive) {
                sync.reconnect();
            }
        });

        return () => {
            sync.stop();
            void listener.then((handle) => handle.remove());
        };
    }, [storeId, enabled, queryClient]);
};
