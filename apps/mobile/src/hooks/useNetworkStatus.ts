import { useEffect, useState } from "react";
import { onlineManager } from "@tanstack/react-query";

/**
 * Hook to monitor network connectivity status
 * Uses TanStack Query's onlineManager which integrates with the browser's online/offline events
 */
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(onlineManager.isOnline());

    useEffect(() => {
        // Subscribe to online status changes
        const unsubscribe = onlineManager.subscribe((online) => {
            setIsOnline(online);
        });

        return unsubscribe;
    }, []);

    return {
        isOnline,
        isOffline: !isOnline,
    };
};
