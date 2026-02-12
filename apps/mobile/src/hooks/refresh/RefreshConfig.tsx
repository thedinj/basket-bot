import { useQueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useCallback, useMemo, useState } from "react";
import { RefreshContext } from "./RefreshContext";

interface RefreshConfigProps {
    /** Query keys to use for refresh operations in this context */
    queryKeys?: string[][];
}

/**
 * Wrapper component that provides local refresh context for its children
 * Each RefreshConfig is independent - no global state conflicts
 * Use this to wrap page/modal content that supports refresh operations
 *
 * @example
 * <RefreshConfig queryKeys={[["stores"]]}>
 *   <AppHeader><GlobalActions /></AppHeader>
 *   <IonContent>
 *     <PullToRefresh />
 *     <StoresListContent />
 *   </IonContent>
 * </RefreshConfig>
 */
const RefreshConfig: React.FC<PropsWithChildren<RefreshConfigProps>> = ({
    queryKeys,
    children,
}) => {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshQueryKeys, setRefreshQueryKeys] = useState<string[][] | null>(null);
    const configuredQueryKeys = queryKeys || null;

    const refresh = useCallback(
        async (explicitQueryKeys?: string[][]) => {
            // If already refreshing, skip (TanStack Query will dedupe but we can avoid extra state updates)
            if (isRefreshing) {
                return;
            }

            // Use provided keys, or fall back to configured keys, or refresh all
            const keysToRefresh = explicitQueryKeys ?? configuredQueryKeys;

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

    // No-op setConfiguredQueryKeys for backward compatibility (not used in local-only context)
    const setConfiguredQueryKeys = useCallback(() => {
        // This is a no-op in local context mode
    }, []);

    const value = useMemo(
        () => ({
            isRefreshing,
            refreshQueryKeys,
            configuredQueryKeys,
            setConfiguredQueryKeys,
            refresh,
        }),
        [isRefreshing, refreshQueryKeys, configuredQueryKeys, setConfiguredQueryKeys, refresh]
    );

    return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
};

export default RefreshConfig;
