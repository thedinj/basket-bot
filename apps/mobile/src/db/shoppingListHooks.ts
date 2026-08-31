import { ApiError } from "@/lib/api/client";
import type {
    ShoppingListItem,
    ShoppingListItemInput,
    ShoppingListItemWithDetails,
    Store,
} from "@basket-bot/core";
import { useIonAlert } from "@ionic/react";
import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
    useSuspenseQuery as useTanstackSuspenseQuery,
    useSuspenseQueries as useTanstackSuspenseQueries,
} from "@tanstack/react-query";
import pluralize from "pluralize";
import { useMemo } from "react";
import { useRefreshContext } from "../hooks/refresh/useRefreshContext";
import { useToast } from "../hooks/useToast";
import { markErrorHandled } from "../utils/errorUtils";
import { sortStoresByPreference } from "../utils/storeSort";
import { filterVisibleStores } from "../utils/storeVisibility";
import { sortNamedItems, useDatabase } from "./hooksShared";
import { useOptimisticMutation } from "./optimisticUpdates";
import { queryKeys } from "./queryKeys";
import { useStores } from "./storeHooks";

// ========== ShoppingList Hooks ==========

/**
 * Hook to get shopping list items for a store (grouped and sorted)
 */
export function useShoppingListItems(storeId: string) {
    const database = useDatabase();

    return useTanstackSuspenseQuery({
        queryKey: queryKeys.shoppingListItems.byStore(storeId),
        queryFn: async () => {
            const items = await database.getShoppingListItems(storeId);
            return sortNamedItems(items);
        },
    });
}

/**
 * Non-suspending view of the same cache entry `useShoppingListItems` populates — identical
 * query key and fetcher, so both observers always see the same data and one invalidation
 * updates both.
 *
 * Use this from components that render *outside* the list's Suspense boundary (the header),
 * where suspending would blank the toolbar. Returns `[]` until the data lands, then re-renders
 * with it. Prefer `useShoppingListItems` anywhere inside the boundary — this exists so header
 * chrome can derive from list data during its own render instead of having a child compute the
 * value and report it upward, which is the pattern that repeatedly produced stale-header bugs.
 */
export function useShoppingListItemsIfLoaded(storeId: string): ShoppingListItemWithDetails[] {
    const database = useDatabase();

    const { data } = useTanstackQuery({
        queryKey: queryKeys.shoppingListItems.byStore(storeId),
        queryFn: async () => {
            const items = await database.getShoppingListItems(storeId);
            return sortNamedItems(items);
        },
    });

    return data ?? EMPTY_SHOPPING_LIST_ITEMS;
}

// Stable identity so `useShoppingListItemsIfLoaded` consumers' memo deps don't churn while loading.
const EMPTY_SHOPPING_LIST_ITEMS: ShoppingListItemWithDetails[] = [];

/**
 * Hook to get shopping list items across every visible store, grouped by store and in the
 * same order as the store tab bar. Reuses `queryKeys.shoppingListItems.byStore` for each
 * store so results share cache (and invalidations) with `useShoppingListItems`.
 */
export function useShoppingListItemsAllStores(): Array<{
    store: Store;
    items: ShoppingListItemWithDetails[];
}> {
    const database = useDatabase();
    const { data: allStores } = useStores();
    const stores = useMemo(
        () => sortStoresByPreference(filterVisibleStores(allStores)),
        [allStores]
    );

    const results = useTanstackSuspenseQueries({
        queries: stores.map((store) => ({
            queryKey: queryKeys.shoppingListItems.byStore(store.id),
            queryFn: async () => sortNamedItems(await database.getShoppingListItems(store.id)),
        })),
    });

    return useMemo(
        () => stores.map((store, index) => ({ store, items: results[index].data })),
        [stores, results]
    );
}

/**
 * Hook to search store items for autocomplete
 */
export function useStoreItemAutocomplete(storeId: string, searchTerm: string) {
    const database = useDatabase();

    return useTanstackQuery({
        queryKey: queryKeys.storeItemSearch.forTerm(storeId, searchTerm),
        queryFn: () => database.searchStoreItems(storeId, searchTerm, 10),
        enabled: !!storeId && searchTerm.length >= 2,
        staleTime: 30000, // Cache for 30 seconds
    });
}

/**
 * Hook to upsert a shopping list item
 */
export function useUpsertShoppingListItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation<ShoppingListItem, Error, ShoppingListItemInput>({
        mutationFn: (params) =>
            database.upsertShoppingListItem(params) as Promise<ShoppingListItem>,
        meta: { operation: "save item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
            // Also invalidate store items (upsert can create a new store item)
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.storeItemSearch.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to update a shopping list item's `isUnsure` / `snoozedUntil` fields from the swipe
 * actions on the list row. Goes through the same full-replace upsert as the editor modal
 * (callers must send the item's other current field values via `toUpsertPayload`), but with
 * an optimistic cache update so the gesture feels instant. `operation` labels the mutation
 * for the global error toast (e.g. "mark item unsure", "snooze item").
 */
export function useSwipeUpdateShoppingListItem(operation: string) {
    const database = useDatabase();

    return useOptimisticMutation<ShoppingListItemInput, ShoppingListItem>({
        mutationFn: (params) =>
            database.upsertShoppingListItem(params) as Promise<ShoppingListItem>,
        meta: { operation },
        queryKeys: (vars) => [queryKeys.shoppingListItems.byStore(vars.storeId)],
        updateCache: (vars) => ({
            queryKey: queryKeys.shoppingListItems.byStore(vars.storeId),
            updateFn: (old: unknown) => {
                const items = old as ShoppingListItemWithDetails[] | undefined;
                if (!items) return items;
                return items.map((item) =>
                    item.id === vars.id
                        ? { ...item, isUnsure: vars.isUnsure, snoozedUntil: vars.snoozedUntil }
                        : item
                );
            },
        }),
    });
}

/**
 * Hook to toggle shopping list item checked status
 * Uses optimistic updates for instant UI feedback
 * Shows alert if item was already checked by another user (requires dismissal)
 */
export function useToggleItemChecked() {
    const database = useDatabase();
    const [presentAlert] = useIonAlert();
    const refreshContext = useRefreshContext();

    return useOptimisticMutation({
        mutationFn: (params: { id: string; isChecked: boolean; storeId: string }) =>
            database.toggleShoppingListItemChecked(params.storeId, params.id, params.isChecked),
        meta: { operation: "update item" },
        queryKeys: (vars) => [queryKeys.shoppingListItems.byStore(vars.storeId)],
        updateCache: (vars) => ({
            queryKey: queryKeys.shoppingListItems.byStore(vars.storeId),
            updateFn: (old: unknown) => {
                const items = old as ShoppingListItemWithDetails[] | undefined;
                if (!items) return items;
                return items.map((item) =>
                    item.id === vars.id
                        ? {
                              ...item,
                              isChecked: vars.isChecked,
                              checkedAt: vars.isChecked ? new Date().toISOString() : null,
                              // Clear snooze when checking (backend does this too)
                              snoozedUntil: vars.isChecked ? null : item.snoozedUntil,
                          }
                        : item
                );
            },
        }),
        onSuccess: (result) => {
            if (result.conflict && result.conflictUser) {
                const itemDisplay = result.itemName ? `"${result.itemName}"` : "This item";
                presentAlert({
                    header: "Already Checked",
                    message: `${itemDisplay} was already checked by ${result.conflictUser.name}.`,
                    buttons: ["OK"],
                });
            }
        },
        onError: async (error, vars) => {
            // Gracefully handle 404 - item was already deleted
            if (error instanceof ApiError && error.status === 404) {
                markErrorHandled(error);
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext.refresh([
                        queryKeys.shoppingListItems.byStore(vars.storeId),
                    ]);
                }
            }
        },
    });
}

/**
 * Hook to delete a shopping list item
 */
export function useDeleteShoppingListItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const refreshContext = useRefreshContext();

    return useTanstackMutation({
        mutationFn: (params: { id: string; storeId: string }) =>
            database.deleteShoppingListItem(params.storeId, params.id),
        meta: { operation: "delete item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
        onError: async (error: unknown, variables) => {
            // Gracefully handle 404 - item was already deleted
            if (error instanceof ApiError && error.status === 404) {
                markErrorHandled(error);
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext.refresh([
                        queryKeys.shoppingListItems.byStore(variables.storeId),
                    ]);
                }
            }
        },
    });
}

/**
 * Hook to remove a shopping list item without deleting the store item
 * Used when moving items between stores
 */
export function useRemoveShoppingListItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const refreshContext = useRefreshContext();

    return useTanstackMutation({
        mutationFn: (params: { id: string; storeId: string }) =>
            database.removeShoppingListItem(params.storeId, params.id),
        meta: { operation: "remove item" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
        onError: async (error: unknown, variables) => {
            // Gracefully handle 404 - item was already removed
            if (error instanceof ApiError && error.status === 404) {
                markErrorHandled(error);
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext.refresh([
                        queryKeys.shoppingListItems.byStore(variables.storeId),
                    ]);
                }
            }
        },
    });
}

/**
 * Hook to clear all checked items from a shopping list
 * Uses optimistic updates for instant UI feedback
 */
export function useClearCheckedItems() {
    const database = useDatabase();
    const { showSuccess } = useToast();

    return useOptimisticMutation({
        mutationFn: ({ storeId }: { storeId: string }) =>
            database.clearCheckedShoppingListItems(storeId),
        meta: { operation: "clear checked items" },
        queryKeys: (vars) => [queryKeys.shoppingListItems.byStore(vars.storeId)],
        updateCache: (vars) => ({
            queryKey: queryKeys.shoppingListItems.byStore(vars.storeId),
            updateFn: (old: unknown) => {
                const items = old as ShoppingListItemWithDetails[] | undefined;
                if (!items) return items;
                return items.filter((item) => !item.isChecked);
            },
        }),
        onSuccess: (count) => {
            if (count > 0) {
                showSuccess(`Cleared ${count} ${pluralize("item", count)}`);
            }
        },
    });
}

/**
 * Hook to move a shopping list item from one store to another
 * Handles both regular items and ideas
 */
export function useMoveItemToStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: async (params: {
            item: {
                id: string;
                itemName: string | null;
                notes: string | null;
                qty: number | null;
                unitId: string | null;
                isIdea: boolean;
                isSample: boolean | null;
                isUnsure: boolean | null;
                isPrivate: boolean | null;
                snoozedUntil: string | null;
            };
            sourceStoreId: string;
            targetStoreId: string;
            targetStoreName: string;
        }) => {
            const { item, targetStoreId, targetStoreName } = params;
            const itemName = item.isIdea ? item.notes || "" : item.itemName;

            if (item.isIdea) {
                // Move idea - just notes, no store item needed
                await database.upsertShoppingListItem({
                    storeId: targetStoreId,
                    storeItemId: null,
                    qty: 1,
                    notes: item.notes,
                    isIdea: true,
                    isSample: item.isSample,
                    isUnsure: item.isUnsure,
                    isPrivate: item.isPrivate,
                    snoozedUntil: item.snoozedUntil,
                });
            } else {
                // Move regular item - get or create store item at target store
                // This will match by normalized_name if item exists at target store
                const targetStoreItem = await database.getOrCreateStoreItemByName(
                    targetStoreId,
                    item.itemName!,
                    null, // Will use existing location if item found by normalized_name
                    null
                );

                // Create shopping list item at target store
                await database.upsertShoppingListItem({
                    storeId: targetStoreId,
                    storeItemId: targetStoreItem.id,
                    qty: item.qty,
                    unitId: item.unitId,
                    notes: item.notes,
                    isSample: item.isSample,
                    isUnsure: item.isUnsure,
                    isPrivate: item.isPrivate,
                    snoozedUntil: item.snoozedUntil,
                });
            }

            // Remove from current store (without removing the store item). If this
            // fails after the item was already created at the target store, the item
            // now exists in both places - surface that explicitly rather than the
            // generic "failed to move item" message, since a plain retry would
            // duplicate it further.
            try {
                await database.removeShoppingListItem(params.sourceStoreId, item.id);
            } catch (removeError) {
                const reason =
                    removeError instanceof Error ? removeError.message : "an unknown error";
                throw new Error(
                    `"${itemName}" was copied to ${targetStoreName} but could not be removed from its original list (${reason}). Check both lists.`
                );
            }

            return { itemName, targetStoreName };
        },
        meta: { operation: "move item" },
        onSuccess: (_, variables) => {
            // Invalidate both source and target store queries
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.sourceStoreId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.targetStoreId),
            });
            // A store item may be created at the target store (getOrCreateStoreItemByName)
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.targetStoreId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.targetStoreId),
            });
        },
    });
}
