import type {
    ShoppingListItem,
    ShoppingListItemInput,
    ShoppingListItemWithDetails,
    StoreItemWithDetails,
} from "@basket-bot/core";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
    useSuspenseQuery as useTanstackSuspenseQuery,
} from "@tanstack/react-query";
import pluralize from "pluralize";
import { use, useCallback } from "react";
import { useShield } from "../components/shield/useShield";
import { useToast } from "../hooks/useToast";
import * as storeSharingApi from "../lib/api/storeSharing";
import { formatErrorMessage } from "../utils/errorUtils";
import { DatabaseContext } from "./context";
import { checkAndInvalidateCoreDataCache } from "./coreDataVersion";
import { useOptimisticMutation, type QueryData } from "./optimisticUpdates";
import { type Database } from "./types";

// ============================================================================
// Core Data Caching Configuration
// ============================================================================

/**
 * Cache times for static/shared tables that rarely or never change
 * - QuantityUnit: Static reference data seeded at app initialization
 * - AppSetting: Infrequently modified application settings
 */
const CORE_DATA_CACHE = {
    /** Static reference data - never changes, cache indefinitely */
    STATIC: {
        staleTime: Infinity,
        gcTime: Infinity,
    },
    /** Infrequently modified settings - cache for 5 minutes */
    SETTINGS: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    },
} as const;

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

/**
 * Hook to preload static/core data tables on app initialization
 * Call this hook early in the app lifecycle to populate the cache
 * with static reference data (quantity units), settings, stores, and store structure
 *
 * Also checks for app version changes and invalidates cache if needed
 */
export const usePreloadCoreData = () => {
    const database = useDatabase();
    const queryClient = useQueryClient();

    const prefetchCoreData = async () => {
        // Check if app version changed and invalidate cache if needed
        await checkAndInvalidateCoreDataCache(queryClient);

        // Prefetch quantity units (static reference data)
        await queryClient.prefetchQuery({
            queryKey: ["quantityUnits"],
            queryFn: () => database.loadAllQuantityUnits(),
            staleTime: CORE_DATA_CACHE.STATIC.staleTime,
        });

        // Prefetch user's stores (30 minute cache)
        try {
            const stores = await queryClient.fetchQuery({
                queryKey: ["stores"],
                queryFn: () => database.loadAllStores(),
                staleTime: 30 * 60 * 1000, // 30 minutes
            });

            // Prefetch aisles and sections for each store (30 minute cache)
            if (stores && stores.length > 0) {
                await Promise.all(
                    stores.flatMap((store) => [
                        queryClient.prefetchQuery({
                            queryKey: ["aisles", store.id],
                            queryFn: () => database.getAislesByStore(store.id),
                            staleTime: 30 * 60 * 1000, // 30 minutes
                        }),
                        queryClient.prefetchQuery({
                            queryKey: ["sections", store.id],
                            queryFn: () => database.getSectionsByStore(store.id),
                            staleTime: 30 * 60 * 1000, // 30 minutes
                        }),
                    ])
                );
            }
        } catch (error) {
            console.error("[usePreloadCoreData] Failed to prefetch stores:", error);
            // Don't block app initialization on preload failures
        }
    };

    return { prefetchCoreData };
};

// ============================================================================
// Entity-specific Query Hooks
// ============================================================================

/**
 * Hook to fetch all stores
 */
export function useStores() {
    const database = useDatabase();
    return useTanstackSuspenseQuery({
        queryKey: ["stores"],
        queryFn: () => database.loadAllStores(),
    });
}

/**
 * Hook to fetch all quantity units
 * Static reference data cached indefinitely - never changes after app initialization
 */
export function useQuantityUnits() {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["quantityUnits"],
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
        queryKey: ["stores", id],
        queryFn: () => database.getStoreById(id),
        enabled: !!id,
    });
}

/**
 * Hook to fetch a single app setting by key
 * Infrequently modified settings cached for 5 minutes
 */
export function useAppSetting(key: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: ["appSettings", key],
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
        mutationFn: ({ id, name }: { id: string; name: string }) => database.updateStore(id, name),
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
        mutationFn: ({ storeId, id, name }: { id: string; name: string; storeId: string }) =>
            database.updateAisle(storeId, id, name),
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
        mutationFn: ({ storeId, id }: { id: string; storeId: string }) =>
            database.deleteAisle(storeId, id),
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
            storeId,
            updates,
        }: {
            storeId: string;
            updates: Array<{ id: string; sortOrder: number }>;
        }) => database.reorderAisles(storeId, updates),
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
            storeId,
            id,
            name,
            aisleId,
        }: {
            storeId: string;
            id: string;
            name: string;
            aisleId: string;
        }) => database.updateSection(storeId, id, name, aisleId),
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
        mutationFn: ({ storeId, id }: { id: string; storeId: string }) =>
            database.deleteSection(storeId, id),
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
            storeId,
            sectionId,
            newAisleId,
            sourceSections,
            destSections,
            sectionName,
        }: {
            storeId: string;
            sectionId: string;
            newAisleId: string;
            newSortOrder: number;
            sourceSections: Array<{ id: string; sortOrder: number }>;
            destSections: Array<{ id: string; sortOrder: number }>;
            sectionName: string;
        }) => {
            // Update section's aisle (sortOrder will be set by reorderSections)
            await database.updateSection(storeId, sectionId, sectionName, newAisleId);

            // Reorder sections in source aisle (close the gap)
            if (sourceSections.length > 0) {
                await database.reorderSections(storeId, sourceSections);
            }

            // Reorder sections in destination aisle (make room and set moved section's sortOrder)
            if (destSections.length > 0) {
                await database.reorderSections(storeId, destSections);
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
            storeId,
            updates,
        }: {
            storeId: string;
            updates: Array<{ id: string; sortOrder: number }>;
        }) => database.reorderSections(storeId, updates),
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
 * Hook to bulk replace all aisles and sections for a store with progress tracking
 * Deletes all existing aisles (CASCADE deletes sections) then creates new ones
 * Shows progress via shield and keeps screen awake during operation
 */
export function useBulkReplaceAislesAndSections() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError, showSuccess } = useToast();
    const { raiseShield, lowerShield } = useShield();

    const replaceAislesAndSections = useCallback(
        async ({
            storeId,
            aisles,
            sections,
        }: {
            storeId: string;
            aisles: Array<{ name: string; sortOrder: number }>;
            sections: Array<{
                aisleName: string;
                name: string;
                sortOrder: number;
            }>;
        }) => {
            const shieldId = "bulk-replace-aisles";
            let aisleSuccessCount = 0;
            let sectionSuccessCount = 0;
            let errorCount = 0;

            try {
                // Keep screen awake during bulk operation
                if (Capacitor.isNativePlatform()) {
                    await KeepAwake.keepAwake();
                }

                // Step 1: Clear existing layout
                raiseShield(shieldId, "Clearing existing layout...");
                const existingAisles = await database.getAislesByStore(storeId);
                for (const aisle of existingAisles) {
                    await database.deleteAisle(storeId, aisle.id);
                }

                // Step 2: Create new aisles with progress
                const aisleNameToId = new Map<string, string>();

                for (let i = 0; i < aisles.length; i++) {
                    raiseShield(shieldId, `Importing aisle ${i + 1} of ${aisles.length}...`);

                    try {
                        const aisleData = aisles[i];
                        const createdAisle = await database.insertAisle(storeId, aisleData.name);
                        aisleNameToId.set(aisleData.name, createdAisle.id);

                        // Update sort order if needed
                        if (createdAisle.sortOrder !== aisleData.sortOrder) {
                            await database.reorderAisles(storeId, [
                                {
                                    id: createdAisle.id,
                                    sortOrder: aisleData.sortOrder,
                                },
                            ]);
                        }

                        aisleSuccessCount++;
                    } catch (error) {
                        console.error(`Failed to import aisle "${aisles[i].name}":`, error);
                        errorCount++;
                        // Continue with remaining aisles
                    }
                }

                // Step 3: Create sections with progress
                for (let i = 0; i < sections.length; i++) {
                    raiseShield(shieldId, `Importing section ${i + 1} of ${sections.length}...`);

                    try {
                        const sectionData = sections[i];
                        const aisleId = aisleNameToId.get(sectionData.aisleName);
                        if (!aisleId) {
                            console.warn(
                                `Aisle not found for section: ${sectionData.name} in ${sectionData.aisleName}`
                            );
                            errorCount++;
                            continue;
                        }

                        const createdSection = await database.insertSection(
                            storeId,
                            sectionData.name,
                            aisleId
                        );

                        // Update sort order if needed
                        if (createdSection.sortOrder !== sectionData.sortOrder) {
                            await database.reorderSections(storeId, [
                                {
                                    id: createdSection.id,
                                    sortOrder: sectionData.sortOrder,
                                },
                            ]);
                        }

                        sectionSuccessCount++;
                    } catch (error) {
                        console.error(`Failed to import section "${sections[i].name}":`, error);
                        errorCount++;
                        // Continue with remaining sections
                    }
                }

                // Step 4: Invalidate queries to refresh UI
                queryClient.invalidateQueries({
                    queryKey: ["aisles", storeId],
                });
                queryClient.invalidateQueries({
                    queryKey: ["sections", storeId],
                });

                // Show success/error messages
                if (aisleSuccessCount > 0 || sectionSuccessCount > 0) {
                    showSuccess(
                        `Successfully imported ${aisleSuccessCount} ${pluralize("aisle", aisleSuccessCount)} and ${sectionSuccessCount} ${pluralize("section", sectionSuccessCount)}`
                    );
                }

                if (errorCount > 0) {
                    showError(`Failed to import ${errorCount} ${pluralize("item", errorCount)}`);
                }
            } catch (error) {
                showError(
                    error instanceof Error
                        ? `Failed to replace aisles/sections: ${error.message}`
                        : "Failed to replace aisles/sections"
                );
            } finally {
                // Allow screen to sleep again
                if (Capacitor.isNativePlatform()) {
                    await KeepAwake.allowSleep();
                }
                lowerShield(shieldId);
            }
        },
        [database, queryClient, showError, showSuccess, raiseShield, lowerShield]
    );

    return { replaceAislesAndSections };
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
        }) => database.getOrCreateStoreItemByName(storeId, name, aisleId, sectionId),
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
        mutationFn: ({ id, storeId }: { id: string; storeId: string }) =>
            database.deleteItem(storeId, id),
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
 * Uses optimistic updates for instant UI feedback
 */
export function useToggleFavorite() {
    const database = useDatabase();
    const { showError } = useToast();

    return useOptimisticMutation({
        mutationFn: ({ id, storeId }: { id: string; storeId: string }) =>
            database.toggleItemFavorite(storeId, id),
        queryKeys: (vars) => [
            ["items", vars.storeId],
            ["items", "with-details", vars.storeId],
            ["items", "detail", vars.id],
        ],
        updateCache: (vars) => [
            {
                queryKey: ["items", "with-details", vars.storeId],
                updateFn: (old: unknown) => {
                    const data = old as QueryData<StoreItemWithDetails> | undefined;
                    if (!data?.data) return data;
                    return {
                        ...data,
                        data: data.data.map((item) =>
                            item.id === vars.id ? { ...item, isFavorite: !item.isFavorite } : item
                        ),
                    };
                },
            },
            {
                queryKey: ["items", vars.storeId],
                updateFn: (old: unknown) => {
                    const data = old as QueryData<StoreItemWithDetails> | undefined;
                    if (!data?.data) return data;
                    return {
                        ...data,
                        data: data.data.map((item) =>
                            item.id === vars.id ? { ...item, isFavorite: !item.isFavorite } : item
                        ),
                    };
                },
            },
        ],
        onError: (error) => showError(`Failed to update favorite: ${error.message}`),
    });
}

// ========== ShoppingList Hooks ==========

/**
 * Hook to get shopping list items for a store (grouped and sorted)
 */
export function useShoppingListItems(storeId: string) {
    const database = useDatabase();

    return useTanstackSuspenseQuery({
        queryKey: ["shopping-list-items", storeId],
        queryFn: async () => {
            const items = await database.getShoppingListItems(storeId);
            return items;
        },
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

    return useTanstackMutation<ShoppingListItem, Error, ShoppingListItemInput>({
        mutationFn: (params) =>
            database.upsertShoppingListItem(params) as Promise<ShoppingListItem>,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
            // Also invalidate store items for autocomplete
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["store-items", "search", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error, "save item"));
        },
    });
}

/**
 * Hook to toggle shopping list item checked status
 * Uses optimistic updates for instant UI feedback
 */
export function useToggleItemChecked() {
    const database = useDatabase();
    const { showError } = useToast();

    return useOptimisticMutation({
        mutationFn: (params: { id: string; isChecked: boolean; storeId: string }) =>
            database.toggleShoppingListItemChecked(params.storeId, params.id, params.isChecked),
        queryKeys: (vars) => [["shopping-list-items", vars.storeId]],
        updateCache: (vars) => ({
            queryKey: ["shopping-list-items", vars.storeId],
            updateFn: (old: unknown) => {
                const data = old as QueryData<ShoppingListItemWithDetails> | undefined;
                if (!data?.data) return data;
                return {
                    ...data,
                    data: data.data.map((item) =>
                        item.id === vars.id
                            ? {
                                  ...item,
                                  isChecked: vars.isChecked,
                                  checkedAt: vars.isChecked ? new Date().toISOString() : null,
                              }
                            : item
                    ),
                };
            },
        }),
        onError: (error) => showError(formatErrorMessage(error, "update item")),
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
            database.deleteShoppingListItem(params.storeId, params.id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error, "delete item"));
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
            database.removeShoppingListItem(params.storeId, params.id),
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
 * Uses optimistic updates for instant UI feedback
 */
export function useClearCheckedItems() {
    const database = useDatabase();
    const { showError } = useToast();

    return useOptimisticMutation({
        mutationFn: ({ storeId }: { storeId: string }) =>
            database.clearCheckedShoppingListItems(storeId),
        queryKeys: (vars) => [["shopping-list-items", vars.storeId]],
        updateCache: (vars) => ({
            queryKey: ["shopping-list-items", vars.storeId],
            updateFn: (old: unknown) => {
                const data = old as QueryData<ShoppingListItemWithDetails> | undefined;
                if (!data?.data) return data;
                return {
                    ...data,
                    data: data.data.filter((item) => !item.isChecked),
                };
            },
        }),
        onError: (error) => showError(formatErrorMessage(error, "clear checked items")),
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
                });
            }

            // Remove from current store (without removing the store item)
            await database.removeShoppingListItem(params.sourceStoreId, item.id);

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

// ============================================================================
// Store Invitations and Collaborators
// ============================================================================

/**
 * Hook to fetch notification counts
 */
export function useNotificationCounts() {
    return useTanstackQuery({
        queryKey: ["notifications", "counts"],
        queryFn: storeSharingApi.getNotificationCounts,
        staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh
    });
}

/**
 * Hook to fetch store invitations for the current user
 */
export function useStoreInvitations() {
    return useTanstackQuery({
        queryKey: ["storeInvitations"],
        queryFn: storeSharingApi.getStoreInvitations,
    });
}

/**
 * Hook to fetch collaborators for a store
 */
export function useStoreCollaborators(storeId: string) {
    return useTanstackQuery({
        queryKey: ["storeCollaborators", storeId],
        queryFn: () => storeSharingApi.getStoreCollaborators(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to accept a store invitation
 */
export function useAcceptStoreInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (token: string) => storeSharingApi.acceptStoreInvitation(token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["storeInvitations"] });
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            queryClient.invalidateQueries({ queryKey: ["notifications", "counts"] });
            showSuccess("Invitation accepted!");
        },
        onError: (error: Error) => {
            showError(`Failed to accept invitation: ${error.message}`);
        },
    });
}

/**
 * Hook to decline a store invitation
 */
export function useDeclineStoreInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (token: string) => storeSharingApi.declineStoreInvitation(token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["storeInvitations"] });
            queryClient.invalidateQueries({ queryKey: ["notifications", "counts"] });
            showSuccess("Invitation declined");
        },
        onError: (error: Error) => {
            showError(`Failed to decline invitation: ${error.message}`);
        },
    });
}

/**
 * Hook to invite a collaborator to a store
 */
export function useInviteStoreCollaborator() {
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; email: string; role: "owner" | "editor" }) =>
            storeSharingApi.inviteStoreCollaborator(params.storeId, params.email, params.role),
        onSuccess: () => {
            showSuccess("Invitation sent!");
        },
        onError: (error: Error) => {
            showError(`Failed to send invitation: ${error.message}`);
        },
    });
}

/**
 * Hook to update a store collaborator's role
 */
export function useUpdateStoreCollaboratorRole() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: {
            storeId: string;
            collaboratorUserId: string;
            role: "owner" | "editor";
        }) =>
            storeSharingApi.updateStoreCollaboratorRole(
                params.storeId,
                params.collaboratorUserId,
                params.role
            ),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["storeCollaborators", variables.storeId] });
            showSuccess("Role updated successfully");
        },
        onError: (error: Error) => {
            showError(`Failed to update role: ${error.message}`);
        },
    });
}

/**
 * Hook to remove a collaborator from a store
 */
export function useRemoveStoreCollaborator() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; collaboratorUserId: string }) =>
            storeSharingApi.removeStoreCollaborator(params.storeId, params.collaboratorUserId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["storeCollaborators", variables.storeId] });
            showSuccess("Collaborator removed");
        },
        onError: (error: Error) => {
            showError(`Failed to remove collaborator: ${error.message}`);
        },
    });
}

/**
 * Hook to get outgoing store invitations (pending invitations sent from this store)
 */
export function useOutgoingStoreInvitations(storeId: string) {
    return useTanstackQuery({
        queryKey: ["outgoingStoreInvitations", storeId],
        queryFn: () => storeSharingApi.getOutgoingStoreInvitations(storeId),
    });
}

/**
 * Hook to retract (cancel) a pending store invitation
 */
export function useRetractStoreInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; invitationId: string }) =>
            storeSharingApi.retractStoreInvitation(params.invitationId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["outgoingStoreInvitations", variables.storeId],
            });
            showSuccess("Invitation cancelled");
        },
        onError: (error: unknown) => {
            // Gracefully handle 404 - invitation already accepted/declined
            if (error instanceof Error && error.message.includes("not found")) {
                // Silently refresh - the invitation is already gone
                queryClient.invalidateQueries({ queryKey: ["outgoingStoreInvitations"] });
                return;
            }
            showError(formatErrorMessage(error, "cancel invitation"));
        },
    });
}
