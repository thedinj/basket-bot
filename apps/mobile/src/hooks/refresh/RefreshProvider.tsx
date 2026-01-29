import { useQueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useCallback, useMemo, useState } from "react";
import { RefreshContext } from "./RefreshContext";

/**
 * Provider for shared refresh state
 * Allows multiple components (GlobalActions, PullToRefresh) to coordinate refresh operations
 */
const RefreshProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshQueryKeys, setRefreshQueryKeys] = useState<string[][] | null>(null);
    const [configuredQueryKeys, setConfiguredQueryKeys] = useState<string[][] | null>(null);

    const refresh = useCallback(
        async (queryKeys?: string[][]) => {
            // If already refreshing, skip (TanStack Query will dedupe but we can avoid extra state updates)
            if (isRefreshing) {
                return;
            }

            // Use provided keys, or fall back to configured keys, or refresh all
            const keysToRefresh = queryKeys ?? configuredQueryKeys;

            setIsRefreshing(true);
            setRefreshQueryKeys(keysToRefresh);

            try {
                if (keysToRefresh && keysToRefresh.length > 0) {
                    // Invalidate specific query keys
                    await Promise.all(
                        keysToRefresh.map((key) => queryClient.invalidateQueries({ queryKey: key }))
                    );
                } else {
                    // Invalidate all queries
                    await queryClient.invalidateQueries();
                }
            } finally {
                setIsRefreshing(false);
                setRefreshQueryKeys(null);
            }
        },
        [queryClient, isRefreshing, configuredQueryKeys]
    );

    const value = useMemo(
        () => ({
            isRefreshing,
            refreshQueryKeys,
            configuredQueryKeys,
            setConfiguredQueryKeys,
            refresh,
        }),
        [isRefreshing, refreshQueryKeys, configuredQueryKeys, refresh]
    );

    return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
};

export default RefreshProvider;
