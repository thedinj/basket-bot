import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
    useSuspenseQuery as useTanstackSuspenseQuery,
} from "@tanstack/react-query";
import type { Store } from "@basket-bot/core";
import { useMemo } from "react";
import { useToast } from "../hooks/useToast";
import { filterVisibleStores, type VisibleStoresOptions } from "../utils/storeVisibility";
import { CORE_DATA_CACHE, useDatabase } from "./hooksShared";
import { queryKeys } from "./queryKeys";

// ============================================================================
// Entity-specific Query Hooks
// ============================================================================

/**
 * Hook to fetch all stores
 */
export function useStores() {
    const database = useDatabase();
    return useTanstackSuspenseQuery({
        queryKey: queryKeys.stores.all(),
        queryFn: () => database.loadAllStores(),
    });
}

/**
 * The stores a picker should offer — `useStores()` with the shared visibility rule applied.
 *
 * See `filterVisibleStores` for what `keepStoreId`/`excludeStoreIds` do. Components that already
 * hold a `Store[]` (from props) should call that function directly instead of this hook.
 */
export function useVisibleStores(options: VisibleStoresOptions = {}): Store[] {
    const { keepStoreId, excludeStoreIds } = options;
    const { data: stores } = useStores();

    return useMemo(
        () => filterVisibleStores(stores, { keepStoreId, excludeStoreIds }),
        [stores, keepStoreId, excludeStoreIds]
    );
}

/**
 * Hook to fetch all quantity units
 * Static reference data cached indefinitely - never changes after app initialization
 */
export function useQuantityUnits() {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.quantityUnits(),
        queryFn: () => database.loadAllQuantityUnits(),
        staleTime: CORE_DATA_CACHE.STATIC.staleTime,
        gcTime: CORE_DATA_CACHE.STATIC.gcTime,
    });
}

/**
 * Hook to fetch a single store by ID
 */
export function useStore(id: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.stores.detail(id),
        queryFn: () => database.getStoreById(id),
        enabled: !!id,
    });
}

/**
 * Hook to fetch a single store by ID with Suspense
 */
export function useStoreSuspense(id: string) {
    const database = useDatabase();
    return useTanstackSuspenseQuery({
        queryKey: queryKeys.stores.detail(id),
        queryFn: () => database.getStoreById(id),
    });
}

/**
 * Hook to fetch a single app setting by key
 * Infrequently modified settings cached for 5 minutes
 */
export function useAppSetting(key: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.appSettings.detail(key),
        queryFn: () => database.getAppSetting(key),
        enabled: !!key,
        staleTime: CORE_DATA_CACHE.SETTINGS.staleTime,
        gcTime: CORE_DATA_CACHE.SETTINGS.gcTime,
    });
}

// ============================================================================
// Entity-specific Mutation Hooks
// ============================================================================

/**
 * Hook to create a new store
 */
export function useCreateStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: (name: string) => database.insertStore(name),
        meta: { operation: "create store" },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
        },
    });
}

/**
 * Hook to update a store
 */
export function useUpdateStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => database.updateStore(id, name),
        meta: { operation: "update store" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
            queryClient.invalidateQueries({
                queryKey: queryKeys.stores.detail(variables.id),
            });
        },
    });
}

/**
 * Hook to delete a store
 */
export function useDeleteStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: (id: string) => database.deleteStore(id),
        meta: { operation: "delete store" },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
        },
    });
}

/**
 * Hook to duplicate a store with its layout and optionally items
 */
export function useDuplicateStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: {
            sourceStoreId: string;
            newStoreName: string;
            includeItems: boolean;
        }) => database.duplicateStore(params),
        meta: { operation: "duplicate store" },
        onSuccess: (newStore) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
            showSuccess(`Store "${newStore.name}" created successfully`);
        },
    });
}

/**
 * Hook to save the user's custom store tab order
 */
export function useReorderStores() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: (updates: Array<{ storeId: string; sortOrder: number }>) =>
            database.reorderStores(updates),
        meta: { operation: "reorder stores" },
        onSuccess: () => {
            // The stores query carries the per-user sortOrder, so refreshing it
            // updates both the tab bar and the Stores management modal.
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
        },
    });
}

/**
 * Hook to save an app setting
 */
export function useSaveAppSetting() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ key, value }: { key: string; value: string }) =>
            database.setAppSetting(key, value),
        meta: { operation: "save setting" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.appSettings.detail(variables.key),
            });
        },
    });
}
