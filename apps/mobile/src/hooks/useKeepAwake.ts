import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect } from "react";
import { usePreference } from "./usePreference";

/**
 * Hook to manage "keep screen awake" functionality
 *
 * Persists user preference and automatically manages KeepAwake plugin.
 * When component unmounts, automatically allows screen sleep (per-page behavior).
 *
 * @returns {isEnabled, toggle, showKeepAwake} - Current state, toggle function, and whether to show the button
 */
export const useKeepAwake = () => {
    const { value, savePreference } = usePreference("keep_screen_awake");
    const isEnabled = value === "true";
    const showKeepAwake = Capacitor.isNativePlatform();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        if (isEnabled) {
            KeepAwake.keepAwake().catch((error) => {
                console.error("Failed to keep screen awake:", error);
            });
        } else {
            KeepAwake.allowSleep().catch((error) => {
                console.error("Failed to allow screen sleep:", error);
            });
        }

        // Cleanup: always allow sleep when leaving a page with keep-awake enabled
        return () => {
            KeepAwake.allowSleep().catch((error) => {
                console.error("Failed to allow screen sleep on cleanup:", error);
            });
        };
    }, [isEnabled]);

    const toggle = useCallback(async () => {
        await savePreference(isEnabled ? "false" : "true");
    }, [isEnabled, savePreference]);

    return { isEnabled, toggle, showKeepAwake };
};
