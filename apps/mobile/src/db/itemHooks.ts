import { ApiError } from "@/lib/api/client";
import type { StoreItemWithDetails } from "@basket-bot/core";
import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import { useRefreshContext } from "../hooks/refresh/useRefreshContext";
import { markErrorHandled } from "../utils/errorUtils";
import { sortItemsByName, useDatabase } from "./hooksShared";
import { useOptimisticMutation } from "./optimisticUpdates";
import { queryKeys } from "./queryKeys";

// ============================================================================
// StoreItem Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch all items for a store
 */
export function useStoreItems(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.items.byStore(storeId),
        queryFn: async () => {
            const items = await database.getItemsByStore(storeId);
            return sortItemsByName(items);
        },
        enabled: !!storeId,
    });
}

/**
 * Hook to fetch all items for a store with location details (joined)
 */
export function useStoreItemsWithDetails(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.items.withDetails(storeId),
        queryFn: async () => {
            const items = await database.getItemsByStoreWithDetails(storeId);
            return sortItemsByName(items);
        },
        enabled: !!storeId,
    });
}

/**
 * Hook to fetch a single item by ID
 */
export function useItem(id: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.items.detail(id),
        queryFn: () => database.getItemById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new item
 */
export function useCreateItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({
            storeId,
            name,
            aisleId,
            sectionId,
        }: {
            storeId: string;
            name: string;
            aisleId?: string | null;
            sectionId?: string | null;
        }) => database.insertItem(storeId, name, aisleId, sectionId),
        meta: { operation: "create item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
        },
    });
}

/**
 * Hook to update an item
 */
export function useUpdateItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({
            storeId,
            id,
            name,
            aisleId,
            sectionId,
        }: {
            storeId: string;
            id: string;
            name: string;
            aisleId?: string | null;
            sectionId?: string | null;
        }) => database.updateItem(storeId, id, name, aisleId, sectionId),
        meta: { operation: "update item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.detail(variables.id),
            });
            // Also invalidate shopping list items since they display store item data
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to get or create a store item by name
 * Useful for adding items to shopping lists - finds existing or creates new
 */
export function useGetOrCreateStoreItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({
            storeId,
            name,
            aisleId,
            sectionId,
        }: {
            storeId: string;
            name: string;
            aisleId?: string | null;
            sectionId?: string | null;
        }) => database.getOrCreateStoreItemByName(storeId, name, aisleId, sectionId),
        meta: { operation: "get or create item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
        },
    });
}

/**
 * Hook to delete an item
 */
export function useDeleteItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ id, storeId }: { id: string; storeId: string }) =>
            database.deleteItem(storeId, id),
        meta: { operation: "delete item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            // Deleting a store item removes any shopping-list item that referenced it
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to toggle the favorite status of a store item
 * Uses optimistic updates for instant UI feedback
 */
export function useToggleFavorite() {
    const database = useDatabase();
    const refreshContext = useRefreshContext();

    return useOptimisticMutation({
        mutationFn: ({ id, storeId }: { id: string; storeId: string }) =>
            database.toggleItemFavorite(storeId, id),
        meta: { operation: "update favorite" },
        queryKeys: (vars) => [
            queryKeys.items.byStore(vars.storeId),
            queryKeys.items.withDetails(vars.storeId),
            queryKeys.items.detail(vars.id),
        ],
        updateCache: (vars) => [
            {
                queryKey: queryKeys.items.withDetails(vars.storeId),
                updateFn: (old: unknown) => {
                    const items = old as StoreItemWithDetails[] | undefined;
                    if (!items) return items;
                    return items.map((item) =>
                        item.id === vars.id ? { ...item, isFavorite: !item.isFavorite } : item
                    );
                },
            },
            {
                queryKey: queryKeys.items.byStore(vars.storeId),
                updateFn: (old: unknown) => {
                    const items = old as StoreItemWithDetails[] | undefined;
                    if (!items) return items;
                    return items.map((item) =>
                        item.id === vars.id ? { ...item, isFavorite: !item.isFavorite } : item
                    );
                },
            },
        ],
        onError: async (error, vars) => {
            // Gracefully handle 404 - item was deleted
            if (error instanceof ApiError && error.status === 404) {
                markErrorHandled(error);
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext?.refresh([
                        queryKeys.items.byStore(vars.storeId),
                        queryKeys.items.withDetails(vars.storeId),
                    ]);
                }
            }
        },
    });
}
