import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import { use } from "react";
import { useToast } from "../hooks/useToast";
import type {
    ShoppingListItem,
    ShoppingListItemOptionalId,
} from "../models/Store";
import { DatabaseContext } from "./context";
import { type Database } from "./types";

/**
 * Hook to get database instance directly
 */
export function useDatabase(): Database {
    const context = use(DatabaseContext);
    if (!context) {
        throw new Error("useDatabase must be used within a DatabaseProvider");
    }
    return context.database;
}

// ============================================================================
// Entity-specific Query Hooks
// ============================================================================

/**
 * Hook to fetch all stores
 */
export function useStores() {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["stores"],
        queryFn: () => database.loadAllStores(),
    });
}

/**
 * Hook to fetch all quantity units
 */
export function useQuantityUnits() {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["quantityUnits"],
        queryFn: () => database.loadAllQuantityUnits(),
    });
}

/**
 * Hook to fetch a single store by ID
 */
export function useStore(id: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["stores", id],
        queryFn: () => database.getStoreById(id),
        enabled: !!id,
    });
}

/**
 * Hook to fetch a single app setting by key
 */
export function useAppSetting(key: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["appSettings", key],
        queryFn: () => database.getAppSetting(key),
        enabled: !!key,
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
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: (name: string) => database.insertStore(name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stores"] });
        },
        onError: (error: Error) => {
            showError(`Failed to create store: ${error.message}`);
        },
    });
}

/**
 * Hook to update a store
 */
export function useUpdateStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) =>
            database.updateStore(id, name),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            queryClient.invalidateQueries({
                queryKey: ["stores", variables.id],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to update store: ${error.message}`);
        },
    });
}

/**
 * Hook to delete a store
 */
export function useDeleteStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: (id: string) => database.deleteStore(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stores"] });
        },
        onError: (error: Error) => {
            showError(`Failed to delete store: ${error.message}`);
        },
    });
}

/**
 * Hook to save an app setting
 */
export function useSaveAppSetting() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ key, value }: { key: string; value: string }) =>
            database.setAppSetting(key, value),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["appSettings", variables.key],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to save setting: ${error.message}`);
        },
    });
}

/**
 * Hook to reset the database
 */
export function useResetDatabase() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: (tablesToPersist?: string[]) =>
            database.reset(tablesToPersist),
        onSuccess: () => {
            // Invalidate all queries after reset
            queryClient.invalidateQueries();
        },
        onError: (error: Error) => {
            showError(`Failed to reset database: ${error.message}`);
        },
    });
}

// ============================================================================
// StoreAisle Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch all aisles for a store
 */
export function useStoreAisles(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["aisles", storeId],
        queryFn: () => database.getAislesByStore(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to fetch a single aisle by ID
 */
export function useAisle(id: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["aisles", "detail", id],
        queryFn: () => database.getAisleById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new aisle
 */
export function useCreateAisle() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ storeId, name }: { storeId: string; name: string }) =>
            database.insertAisle(storeId, name),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["aisles", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to create aisle: ${error.message}`);
        },
    });
}

/**
 * Hook to update an aisle
 */
export function useUpdateAisle() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({
            id,
            name,
        }: {
            id: string;
            name: string;
            storeId: string;
        }) => database.updateAisle(id, name),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["aisles", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["aisles", "detail", variables.id],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to update aisle: ${error.message}`);
        },
    });
}

/**
 * Hook to delete an aisle
 */
export function useDeleteAisle() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ id }: { id: string; storeId: string }) =>
            database.deleteAisle(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["aisles", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to delete aisle: ${error.message}`);
        },
    });
}

/**
 * Hook to reorder aisles
 */
export function useReorderAisles() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({
            updates,
        }: {
            updates: Array<{ id: string; sort_order: number }>;
            storeId: string;
        }) => database.reorderAisles(updates),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["aisles", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to reorder aisles: ${error.message}`);
        },
    });
}

// ============================================================================
// StoreSection Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch all sections for a store
 */
export function useStoreSections(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["sections", storeId],
        queryFn: () => database.getSectionsByStore(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to fetch a single section by ID
 */
export function useSection(id: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["sections", "detail", id],
        queryFn: () => database.getSectionById(id),
        enabled: !!id,
    });
}

/**
 * Hook to create a new section
 */
export function useCreateSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({
            storeId,
            name,
            aisleId,
        }: {
            storeId: string;
            name: string;
            aisleId: string;
        }) => database.insertSection(storeId, name, aisleId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["sections", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to create section: ${error.message}`);
        },
    });
}

/**
 * Hook to update a section
 */
export function useUpdateSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({
            id,
            name,
            aisleId,
        }: {
            id: string;
            name: string;
            aisleId: string;
            storeId: string;
        }) => database.updateSection(id, name, aisleId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["sections", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["sections", "detail", variables.id],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to update section: ${error.message}`);
        },
    });
}

/**
 * Hook to delete a section
 */
export function useDeleteSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ id }: { id: string; storeId: string }) =>
            database.deleteSection(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["sections", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to delete section: ${error.message}`);
        },
    });
}

/**
 * Hook to move a section to a different aisle and update sort orders
 */
export function useMoveSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: async ({
            sectionId,
            newAisleId,
            sourceSections,
            destSections,
            sectionName,
        }: {
            sectionId: string;
            newAisleId: string;
            newSortOrder: number;
            sourceSections: Array<{ id: string; sort_order: number }>;
            destSections: Array<{ id: string; sort_order: number }>;
            storeId: string;
            sectionName: string;
        }) => {
            // Update section's aisle (sort_order will be set by reorderSections)
            await database.updateSection(sectionId, sectionName, newAisleId);

            // Reorder sections in source aisle (close the gap)
            if (sourceSections.length > 0) {
                await database.reorderSections(sourceSections);
            }

            // Reorder sections in destination aisle (make room and set moved section's sort_order)
            if (destSections.length > 0) {
                await database.reorderSections(destSections);
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["sections", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to move section: ${error.message}`);
        },
    });
}

/**
 * Hook to reorder sections
 */
export function useReorderSections() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({
            updates,
        }: {
            updates: Array<{ id: string; sort_order: number }>;
            storeId: string;
        }) => database.reorderSections(updates),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["sections", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to reorder sections: ${error.message}`);
        },
    });
}

/**
 * Hook to bulk replace all aisles and sections for a store
 * Deletes all existing aisles (CASCADE deletes sections) then creates new ones
 */
export function useBulkReplaceAislesAndSections() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError, showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: async ({
            storeId,
            aisles,
            sections,
        }: {
            storeId: string;
            aisles: Array<{ name: string; sort_order: number }>;
            sections: Array<{
                aisleName: string;
                name: string;
                sort_order: number;
            }>;
        }) => {
            // Step 1: Get all existing aisles
            const existingAisles = await database.getAislesByStore(storeId);

            // Step 2: Delete all existing aisles (CASCADE will delete sections)
            for (const aisle of existingAisles) {
                await database.deleteAisle(aisle.id);
            }

            // Step 3: Create new aisles and build a map of name -> id
            const aisleNameToId = new Map<string, string>();

            for (const aisleData of aisles) {
                const createdAisle = await database.insertAisle(
                    storeId,
                    aisleData.name
                );
                aisleNameToId.set(aisleData.name, createdAisle.id);

                // Update sort order if needed (insertAisle assigns automatically)
                if (createdAisle.sort_order !== aisleData.sort_order) {
                    await database.reorderAisles([
                        {
                            id: createdAisle.id,
                            sort_order: aisleData.sort_order,
                        },
                    ]);
                }
            }

            // Step 4: Create sections for each aisle
            for (const sectionData of sections) {
                const aisleId = aisleNameToId.get(sectionData.aisleName);
                if (!aisleId) {
                    console.warn(
                        `Aisle not found for section: ${sectionData.name} in ${sectionData.aisleName}`
                    );
                    continue;
                }

                const createdSection = await database.insertSection(
                    storeId,
                    sectionData.name,
                    aisleId
                );

                // Update sort order if needed
                if (createdSection.sort_order !== sectionData.sort_order) {
                    await database.reorderSections([
                        {
                            id: createdSection.id,
                            sort_order: sectionData.sort_order,
                        },
                    ]);
                }
            }

            return { aisleCount: aisles.length, sectionCount: sections.length };
        },
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["aisles", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["sections", variables.storeId],
            });
            showSuccess(
                `Successfully imported ${result.aisleCount} aisles and ${result.sectionCount} sections`
            );
        },
        onError: (error: Error) => {
            showError(`Failed to replace aisles/sections: ${error.message}`);
        },
    });
}

// ============================================================================
// StoreItem Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch all items for a store
 */
export function useStoreItems(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["items", storeId],
        queryFn: () => database.getItemsByStore(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to fetch all items for a store with location details (joined)
 */
export function useStoreItemsWithDetails(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["items", "with-details", storeId],
        queryFn: () => database.getItemsByStoreWithDetails(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to fetch a single item by ID
 */
export function useItem(id: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["items", "detail", id],
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
    const { showError } = useToast();

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
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to create item: ${error.message}`);
        },
    });
}

/**
 * Hook to update an item
 */
export function useUpdateItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({
            id,
            name,
            aisleId,
            sectionId,
        }: {
            id: string;
            name: string;
            aisleId?: string | null;
            sectionId?: string | null;
            storeId: string;
        }) => database.updateItem(id, name, aisleId, sectionId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "detail", variables.id],
            });
            // Also invalidate shopping list items since they display store item data
            queryClient.invalidateQueries({
                queryKey: ["shoppingListItems"],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to update item: ${error.message}`);
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
    const { showError } = useToast();

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
        }) =>
            database.getOrCreateStoreItemByName(
                storeId,
                name,
                aisleId,
                sectionId
            ),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to get or create item: ${error.message}`);
        },
    });
}

/**
 * Hook to delete an item
 */
export function useDeleteItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ id }: { id: string; storeId: string }) =>
            database.deleteItem(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to delete item: ${error.message}`);
        },
    });
}

/**
 * Hook to toggle the favorite status of a store item
 */
export function useToggleFavorite() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ id }: { id: string; storeId: string }) =>
            database.toggleItemFavorite(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "detail", variables.id],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to update favorite: ${error.message}`);
        },
    });
}

// ========== ShoppingList Hooks ==========

/**
 * Hook to get shopping list items for a store (grouped and sorted)
 */
export function useShoppingListItems(storeId: string) {
    const database = useDatabase();

    return useTanstackQuery({
        queryKey: ["shopping-list-items", storeId],
        queryFn: () => database.getShoppingListItems(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to search store items for autocomplete
 */
export function useStoreItemAutocomplete(storeId: string, searchTerm: string) {
    const database = useDatabase();

    return useTanstackQuery({
        queryKey: ["store-items", "search", storeId, searchTerm],
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
    const { showError } = useToast();

    return useTanstackMutation<
        ShoppingListItem,
        Error,
        ShoppingListItemOptionalId
    >({
        mutationFn: (params) =>
            database.upsertShoppingListItem(
                params
            ) as Promise<ShoppingListItem>,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.store_id],
            });
            // Also invalidate store items for autocomplete
            queryClient.invalidateQueries({
                queryKey: ["items", variables.store_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["store-items", "search", variables.store_id],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to save item: ${error.message}`);
        },
    });
}

/**
 * Hook to toggle shopping list item checked status
 */
export function useToggleItemChecked() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: {
            id: string;
            isChecked: boolean;
            storeId: string;
        }) =>
            database.toggleShoppingListItemChecked(params.id, params.isChecked),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to update item: ${error.message}`);
        },
    });
}

/**
 * Hook to delete a shopping list item
 */
export function useDeleteShoppingListItem() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { id: string; storeId: string }) =>
            database.deleteShoppingListItem(params.id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to delete item: ${error.message}`);
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
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { id: string; storeId: string }) =>
            database.removeShoppingListItem(params.id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to remove item: ${error.message}`);
        },
    });
}

/**
 * Hook to clear all checked items from a shopping list
 */
export function useClearCheckedItems() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError } = useToast();

    return useTanstackMutation({
        mutationFn: ({ storeId }: { storeId: string }) =>
            database.clearCheckedShoppingListItems(storeId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to clear checked items: ${error.message}`);
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
                item_name: string;
                notes: string | null;
                qty: number | null;
                unit_id: string | null;
                is_idea: number;
            };
            sourceStoreId: string;
            targetStoreId: string;
            targetStoreName: string;
        }) => {
            const { item, targetStoreId, targetStoreName } = params;
            const itemName = item.is_idea ? item.notes || "" : item.item_name;

            if (item.is_idea) {
                // Move idea - just notes, no store item needed
                await database.upsertShoppingListItem({
                    store_id: targetStoreId,
                    store_item_id: null,
                    qty: 1,
                    unit_id: null,
                    notes: item.notes,
                    is_idea: 1,
                });
            } else {
                // Move regular item - get or create store item at target store
                // This will match by normalized_name if item exists at target store
                const targetStoreItem =
                    await database.getOrCreateStoreItemByName(
                        targetStoreId,
                        item.item_name,
                        null, // Will use existing location if item found by normalized_name
                        null
                    );

                // Create shopping list item at target store
                await database.upsertShoppingListItem({
                    store_id: targetStoreId,
                    store_item_id: targetStoreItem.id,
                    qty: item.qty,
                    unit_id: item.unit_id,
                    notes: item.notes,
                    is_idea: 0,
                });
            }

            // Remove from current store (without removing the store item)
            await database.removeShoppingListItem(item.id);

            return { itemName, targetStoreName };
        },
        onSuccess: (_, variables) => {
            // Invalidate both source and target store queries
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.sourceStoreId],
            });
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.targetStoreId],
            });
        },
    });
}
