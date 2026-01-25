import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { apiClient } from "../lib/api/client";
import { mutationQueue } from "../lib/mutationQueue";
import { useToast } from "./useToast";

/**
 * Hook to manually refresh data by invalidating queries
 */
export const useRefresh = () => {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refresh = useCallback(
        async (queryKeys?: string[][]) => {
            setIsRefreshing(true);
            try {
                if (queryKeys && queryKeys.length > 0) {
                    // Invalidate specific query keys
                    await Promise.all(
                        queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
                    );
                } else {
                    // Invalidate all queries
                    await queryClient.invalidateQueries();
                }
            } finally {
                setIsRefreshing(false);
            }
        },
        [queryClient]
    );

    return { refresh, isRefreshing };
};

/**
 * Hook to manually sync queued mutations
 */
export const useSync = () => {
    const { showError, showSuccess, showInfo } = useToast();
    const queryClient = useQueryClient();
    const [isSyncing, setIsSyncing] = useState(false);

    const sync = useCallback(async () => {
        const queueSize = mutationQueue.getQueueSize();

        if (queueSize === 0) {
            showInfo("No pending changes to sync");
            return;
        }

        setIsSyncing(true);

        try {
            const result = await mutationQueue.processQueue(async (mutation) => {
                // Re-execute the mutation via API
                switch (mutation.method) {
                    case "POST":
                        await apiClient.post(mutation.endpoint, mutation.data);
                        break;
                    case "PUT":
                        await apiClient.put(mutation.endpoint, mutation.data);
                        break;
                    case "PATCH":
                        await apiClient.patch(mutation.endpoint, mutation.data);
                        break;
                    case "DELETE":
                        await apiClient.delete(mutation.endpoint);
                        break;
                    default:
                        throw new Error(`Unsupported method: ${mutation.method}`);
                }
            });

            // Invalidate queries after successful sync to refresh UI
            if (result.success > 0) {
                await queryClient.invalidateQueries();
                showSuccess(`Synced ${result.success} change${result.success === 1 ? "" : "s"}`);
            }

            if (result.failed > 0) {
                showError(
                    `Failed to sync ${result.failed} change${result.failed === 1 ? "" : "s"}. Some changes may have been rejected by the server.`
                );
            }
        } catch (error) {
            console.error("[useSync] Error syncing mutations:", error);
            showError("Failed to sync changes. Please try again.");
        } finally {
            setIsSyncing(false);
        }
    }, [queryClient, showError, showSuccess, showInfo]);

    return { sync, isSyncing };
};
