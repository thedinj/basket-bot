import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Optimistic Updates Utilities
 *
 * This module provides a reusable hook for implementing optimistic updates in TanStack Query.
 * Optimistic updates make the UI feel instant by updating the cache immediately before the
 * API call completes, then syncing with the server when it responds.
 *
 * **How to use:**
 *
 * ```typescript
 * const toggleChecked = useOptimisticMutation({
 *   mutationFn: (params) => database.toggleItem(params),
 *   queryKeys: (vars) => [["items", vars.storeId]],
 *   updateCache: (vars) => ({
 *     queryKey: ["items", vars.storeId],
 *     updateFn: (old: QueryData<Item>) => {
 *       if (!old?.data) return old;
 *       return {
 *         ...old,
 *         data: old.data.map(item =>
 *           item.id === vars.id ? { ...item, isChecked: vars.isChecked } : item
 *         ),
 *       };
 *     },
 *   }),
 *   onError: (error) => showError(error.message),
 * });
 * ```
 *
 * **Key principles:**
 * - Automatically cancels in-flight queries to prevent race conditions
 * - Snapshots previous values for rollback
 * - Updates cache with proper types (no 'any')
 * - Always invalidates queries in onSettled to sync with server
 * - Rolls back on error to maintain data integrity
 */

/**
 * Query data structure returned by TanStack Query
 */
export interface QueryData<T> {
    data: T[];
}

/**
 * Configuration for a single cache update
 */
export interface CacheUpdate {
    queryKey: unknown[];
    updateFn: (oldData: unknown) => unknown;
}

/**
 * Context returned from onMutate for rollback
 */
interface MutationContext {
    snapshots: Array<{
        queryKey: unknown[];
        previousData: unknown;
    }>;
}

/**
 * Configuration for optimistic mutation hook
 */
export interface OptimisticMutationConfig<TVariables, TData, TError = Error> {
    /**
     * The mutation function to execute
     */
    mutationFn: (variables: TVariables) => Promise<TData>;

    /**
     * Query keys to invalidate after mutation completes
     * Can be static array or function that takes variables
     */
    queryKeys: unknown[][] | ((variables: TVariables) => unknown[][]);

    /**
     * Function that returns cache updates to apply optimistically
     * Can return single update or array for multiple caches
     */
    updateCache:
        | ((variables: TVariables) => CacheUpdate | CacheUpdate[])
        | CacheUpdate
        | CacheUpdate[];

    /**
     * Optional error handler
     */
    onError?: (error: TError, variables: TVariables) => void;

    /**
     * Optional success handler
     */
    onSuccess?: (data: TData, variables: TVariables) => void;
}

/**
 * Generic hook for mutations with optimistic updates
 * Eliminates boilerplate for optimistic update pattern
 *
 * @example
 * ```typescript
 * const toggleChecked = useOptimisticMutation({
 *   mutationFn: (params: { id: string; isChecked: boolean; storeId: string }) =>
 *     database.toggleShoppingListItemChecked(params.storeId, params.id, params.isChecked),
 *   queryKeys: (vars) => [["shopping-list-items", vars.storeId]],
 *   updateCache: (vars) => ({
 *     queryKey: ["shopping-list-items", vars.storeId],
 *     updateFn: (old: QueryData<ShoppingListItemWithDetails>) => {
 *       if (!old?.data) return old;
 *       return {
 *         ...old,
 *         data: old.data.map(item =>
 *           item.id === vars.id
 *             ? { ...item, isChecked: vars.isChecked, checkedAt: vars.isChecked ? new Date().toISOString() : null }
 *             : item
 *         ),
 *       };
 *     },
 *   }),
 *   onError: (error) => showError(`Failed: ${error.message}`),
 * });
 * ```
 */
export const useOptimisticMutation = <TVariables, TData = void, TError = Error>(
    config: OptimisticMutationConfig<TVariables, TData, TError>
): UseMutationResult<TData, TError, TVariables, MutationContext> => {
    const queryClient = useQueryClient();

    const mutationOptions: UseMutationOptions<TData, TError, TVariables, MutationContext> = {
        mutationFn: config.mutationFn,

        onMutate: async (variables) => {
            // Normalize cache updates to array
            const cacheUpdates = Array.isArray(config.updateCache)
                ? config.updateCache
                : typeof config.updateCache === "function"
                  ? [config.updateCache(variables)].flat()
                  : [config.updateCache];

            // Cancel all affected queries
            await Promise.all(
                cacheUpdates.map((update) =>
                    queryClient.cancelQueries({ queryKey: update.queryKey })
                )
            );

            // Snapshot all previous values
            const snapshots = cacheUpdates.map((update) => ({
                queryKey: update.queryKey,
                previousData: queryClient.getQueryData(update.queryKey),
            }));

            // Apply optimistic updates
            cacheUpdates.forEach((update) => {
                queryClient.setQueryData(update.queryKey, update.updateFn);
            });

            // Return context for rollback
            return { snapshots };
        },

        onError: (error, variables, context) => {
            // Rollback all snapshots
            if (context?.snapshots) {
                context.snapshots.forEach(({ queryKey, previousData }) => {
                    queryClient.setQueryData(queryKey, previousData);
                });
            }

            // Call custom error handler
            config.onError?.(error, variables);
        },

        onSuccess: config.onSuccess,

        onSettled: (_, __, variables) => {
            // Invalidate all affected queries to sync with server
            const queryKeys =
                typeof config.queryKeys === "function"
                    ? config.queryKeys(variables)
                    : config.queryKeys;

            queryKeys.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey });
            });
        },
    };

    return useMutation(mutationOptions);
};
