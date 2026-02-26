import { ApiError } from "@/lib/api/client";
import type {
    ShoppingListItem,
    ShoppingListItemInput,
    ShoppingListItemWithDetails,
    StoreItemWithDetails,
} from "@basket-bot/core";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import { useIonAlert } from "@ionic/react";
import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
    useSuspenseQuery as useTanstackSuspenseQuery,
} from "@tanstack/react-query";
import pluralize from "pluralize";
import { use, useCallback, useMemo } from "react";
import { useShield } from "../components/shield/useShield";
import { useRefreshContext } from "../hooks/refresh/useRefreshContext";
import { useToast } from "../hooks/useToast";
import { householdApi, invitationApi } from "../lib/api/household";
import * as storeSharingApi from "../lib/api/storeSharing";
import { formatErrorMessage } from "../utils/errorUtils";
import { DatabaseContext } from "./context";
import { checkAndInvalidateCoreDataCache } from "./coreDataVersion";
import { useOptimisticMutation } from "./optimisticUpdates";
import { type Database } from "./types";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sort items alphabetically by a key extraction function (case-insensitive)
 */
function sortByKey<T>(items: T[], getKey: (item: T) => string): T[] {
    return items.sort((a, b) =>
        getKey(a).localeCompare(getKey(b), undefined, { sensitivity: "base" })
    );
}

/**
 * Sort items alphabetically by name property (case-insensitive)
 */
function sortItemsByName<T extends { name: string }>(items: T[]): T[] {
    return sortByKey(items, (item) => item.name);
}

/**
 * Sort shopping list items alphabetically by display name (case-insensitive)
 * Uses itemName for regular items, notes for ideas
 */
function sortNamedItems(items: ShoppingListItemWithDetails[]): ShoppingListItemWithDetails[] {
    return sortByKey(items, (item) => item.itemName || item.notes || "");
}

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

    const prefetchCoreData = useCallback(async () => {
        // Check if app version changed and invalidate cache if needed
        await checkAndInvalidateCoreDataCache(queryClient);

        // Prefetch quantity units and stores in parallel
        try {
            const [, stores] = await Promise.all([
                queryClient.prefetchQuery({
                    queryKey: ["quantityUnits"],
                    queryFn: () => database.loadAllQuantityUnits(),
                    staleTime: CORE_DATA_CACHE.STATIC.staleTime,
                }),
                queryClient.fetchQuery({
                    queryKey: ["stores"],
                    queryFn: () => database.loadAllStores(),
                    staleTime: 30 * 60 * 1000, // 30 minutes
                }),
            ]);

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
            console.error("[usePreloadCoreData] Failed to prefetch quantities and stores:", error);
            // Don't block app initialization on preload failures
        }
    }, [database, queryClient]);

    return useMemo(() => ({ prefetchCoreData }), [prefetchCoreData]);
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
 * Hook to fetch a single store by ID with Suspense
 */
export function useStoreSuspense(id: string) {
    const database = useDatabase();
    return useTanstackSuspenseQuery({
        queryKey: ["stores", id],
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
 * Hook to duplicate a store with its layout and optionally items
 */
export function useDuplicateStore() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError, showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: {
            sourceStoreId: string;
            newStoreName: string;
            includeItems: boolean;
        }) => database.duplicateStore(params),
        onSuccess: (newStore) => {
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            showSuccess(`Store "${newStore.name}" created successfully`);
        },
        onError: (error: Error) => {
            showError(`Failed to duplicate store: ${error.message}`);
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
            // Invalidate store items since they display aisle names
            queryClient.invalidateQueries({
                queryKey: ["items", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            // Invalidate shopping list items since they display aisle names
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
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
            // Invalidate store items and shopping list since aisle was deleted
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
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
            // Invalidate shopping list items since they display items in aisle order
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
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
            // Invalidate store items since they display section names
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            // Invalidate shopping list items since they display section names and order
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
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
            // Invalidate store items and shopping list since section was deleted
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
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
            // Invalidate store items since section locations changed
            queryClient.invalidateQueries({
                queryKey: ["items", "with-details", variables.storeId],
            });
            // Invalidate shopping list items since they display section order
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
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
            // Invalidate shopping list items since they display items in section order
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: (error: Error) => {
            showError(`Failed to reorder sections: ${error.message}`);
        },
    });
}

/**
 * Hook to bulk replace all aisles and sections for a store with progress tracking
 * Preserves existing aisle/section IDs when matched, updates sort order, creates new ones, and deletes orphans
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
            aisles: Array<{ id?: string; name: string; sortOrder: number }>;
            sections: Array<{
                id?: string;
                aisleName: string;
                name: string;
                sortOrder: number;
            }>;
        }) => {
            const shieldId = "bulk-replace-aisles";
            let aisleUpdatedCount = 0;
            let aisleCreatedCount = 0;
            let aisleDeletedCount = 0;
            let sectionUpdatedCount = 0;
            let sectionCreatedCount = 0;
            let sectionDeletedCount = 0;
            let errorCount = 0;

            try {
                // Keep screen awake during bulk operation
                if (Capacitor.isNativePlatform()) {
                    await KeepAwake.keepAwake();
                }

                // Step 1: Fetch existing aisles and sections
                raiseShield(shieldId, "Analyzing existing layout...");
                const existingAisles = await database.getAislesByStore(storeId);
                const existingSections = await database.getSectionsByStore(storeId);

                // Step 2: Process aisles - update matched ones, create new ones
                const aisleNameToId = new Map<string, string>();
                const processedAisleIds = new Set<string>();

                for (let i = 0; i < aisles.length; i++) {
                    raiseShield(shieldId, `Processing aisle ${i + 1} of ${aisles.length}...`);

                    try {
                        const aisleData = aisles[i];

                        if (aisleData.id) {
                            // Matched existing aisle - update sort order only
                            await database.updateAisleSortOrder(
                                storeId,
                                aisleData.id,
                                aisleData.sortOrder
                            );
                            aisleNameToId.set(aisleData.name, aisleData.id);
                            processedAisleIds.add(aisleData.id);
                            aisleUpdatedCount++;
                        } else {
                            // New aisle - create it
                            const createdAisle = await database.insertAisle(
                                storeId,
                                aisleData.name
                            );
                            aisleNameToId.set(aisleData.name, createdAisle.id);
                            processedAisleIds.add(createdAisle.id);

                            // Update sort order if needed
                            if (createdAisle.sortOrder !== aisleData.sortOrder) {
                                await database.reorderAisles(storeId, [
                                    {
                                        id: createdAisle.id,
                                        sortOrder: aisleData.sortOrder,
                                    },
                                ]);
                            }

                            aisleCreatedCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to process aisle "${aisles[i].name}":`, error);
                        errorCount++;
                        // Continue with remaining aisles
                    }
                }

                // Step 3: Delete orphaned aisles (not in transformed result)
                raiseShield(shieldId, "Removing orphaned aisles...");
                for (const existingAisle of existingAisles) {
                    if (!processedAisleIds.has(existingAisle.id)) {
                        try {
                            await database.deleteAisle(storeId, existingAisle.id);
                            aisleDeletedCount++;
                        } catch (error) {
                            console.error(`Failed to delete aisle "${existingAisle.name}":`, error);
                            errorCount++;
                        }
                    }
                }

                // Step 4: Process sections - update matched ones, create new ones
                const processedSectionIds = new Set<string>();

                for (let i = 0; i < sections.length; i++) {
                    raiseShield(shieldId, `Processing section ${i + 1} of ${sections.length}...`);

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

                        if (sectionData.id) {
                            // Matched existing section - update aisleId and sort order
                            await database.updateSectionLocation(
                                storeId,
                                sectionData.id,
                                aisleId,
                                sectionData.sortOrder
                            );
                            processedSectionIds.add(sectionData.id);
                            sectionUpdatedCount++;
                        } else {
                            // New section - create it
                            const createdSection = await database.insertSection(
                                storeId,
                                sectionData.name,
                                aisleId
                            );
                            processedSectionIds.add(createdSection.id);

                            // Update sort order if needed
                            if (createdSection.sortOrder !== sectionData.sortOrder) {
                                await database.reorderSections(storeId, [
                                    {
                                        id: createdSection.id,
                                        sortOrder: sectionData.sortOrder,
                                    },
                                ]);
                            }

                            sectionCreatedCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to process section "${sections[i].name}":`, error);
                        errorCount++;
                        // Continue with remaining sections
                    }
                }

                // Step 5: Delete orphaned sections (not in transformed result)
                raiseShield(shieldId, "Removing orphaned sections...");
                for (const existingSection of existingSections) {
                    if (!processedSectionIds.has(existingSection.id)) {
                        try {
                            await database.deleteSection(storeId, existingSection.id);
                            sectionDeletedCount++;
                        } catch (error) {
                            console.error(
                                `Failed to delete section "${existingSection.name}":`,
                                error
                            );
                            errorCount++;
                        }
                    }
                }

                // Step 6: Invalidate queries to refresh UI
                queryClient.invalidateQueries({
                    queryKey: ["aisles", storeId],
                });
                queryClient.invalidateQueries({
                    queryKey: ["sections", storeId],
                });

                // Show success/error messages
                const totalChanges =
                    aisleCreatedCount +
                    aisleUpdatedCount +
                    aisleDeletedCount +
                    sectionCreatedCount +
                    sectionUpdatedCount +
                    sectionDeletedCount;

                if (totalChanges > 0) {
                    const parts: string[] = [];

                    if (aisleCreatedCount > 0)
                        parts.push(
                            `${aisleCreatedCount} new ${pluralize("aisle", aisleCreatedCount)}`
                        );
                    if (aisleUpdatedCount > 0)
                        parts.push(
                            `${aisleUpdatedCount} updated ${pluralize("aisle", aisleUpdatedCount)}`
                        );
                    if (sectionCreatedCount > 0)
                        parts.push(
                            `${sectionCreatedCount} new ${pluralize("section", sectionCreatedCount)}`
                        );
                    if (sectionUpdatedCount > 0)
                        parts.push(
                            `${sectionUpdatedCount} updated ${pluralize("section", sectionUpdatedCount)}`
                        );

                    showSuccess(`Store layout updated: ${parts.join(", ")}`);
                }

                if (errorCount > 0) {
                    showError(`Failed to process ${errorCount} ${pluralize("item", errorCount)}`);
                }
            } catch (error) {
                showError(
                    error instanceof Error
                        ? `Failed to update store layout: ${error.message}`
                        : "Failed to update store layout"
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
        queryKey: ["items", "with-details", storeId],
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
    const refreshContext = useRefreshContext();

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
                    const items = old as StoreItemWithDetails[] | undefined;
                    if (!items) return items;
                    return items.map((item) =>
                        item.id === vars.id ? { ...item, isFavorite: !item.isFavorite } : item
                    );
                },
            },
            {
                queryKey: ["items", vars.storeId],
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
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext?.refresh([
                        ["items", vars.storeId],
                        ["items", "with-details", vars.storeId],
                    ]);
                }
                return;
            }
            showError(
                `Failed to update favorite: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        },
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
            return sortNamedItems(items);
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
 * Shows alert if item was already checked by another user (requires dismissal)
 */
export function useToggleItemChecked() {
    const database = useDatabase();
    const { showError } = useToast();
    const [presentAlert] = useIonAlert();
    const refreshContext = useRefreshContext();

    return useOptimisticMutation({
        mutationFn: (params: { id: string; isChecked: boolean; storeId: string }) =>
            database.toggleShoppingListItemChecked(params.storeId, params.id, params.isChecked),
        queryKeys: (vars) => [["shopping-list-items", vars.storeId]],
        updateCache: (vars) => ({
            queryKey: ["shopping-list-items", vars.storeId],
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
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext.refresh([["shopping-list-items", vars.storeId]]);
                }
                return;
            }
            showError(formatErrorMessage(error, "update item"));
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
    const refreshContext = useRefreshContext();

    return useTanstackMutation({
        mutationFn: (params: { id: string; storeId: string }) =>
            database.deleteShoppingListItem(params.storeId, params.id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: async (error: unknown, variables) => {
            // Gracefully handle 404 - item was already deleted
            if (error instanceof ApiError && error.status === 404) {
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext.refresh([["shopping-list-items", variables.storeId]]);
                }
                return;
            }
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
    const refreshContext = useRefreshContext();

    return useTanstackMutation({
        mutationFn: (params: { id: string; storeId: string }) =>
            database.removeShoppingListItem(params.storeId, params.id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["shopping-list-items", variables.storeId],
            });
        },
        onError: async (error: unknown, variables) => {
            // Gracefully handle 404 - item was already removed
            if (error instanceof ApiError && error.status === 404) {
                // Silently refresh to sync with server state
                if (refreshContext) {
                    await refreshContext.refresh([["shopping-list-items", variables.storeId]]);
                }
                return;
            }
            showError(
                `Failed to remove item: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        },
    });
}

/**
 * Hook to clear all checked items from a shopping list
 * Uses optimistic updates for instant UI feedback
 */
export function useClearCheckedItems() {
    const database = useDatabase();
    const { showError, showSuccess } = useToast();

    return useOptimisticMutation({
        mutationFn: ({ storeId }: { storeId: string }) =>
            database.clearCheckedShoppingListItems(storeId),
        queryKeys: (vars) => [["shopping-list-items", vars.storeId]],
        updateCache: (vars) => ({
            queryKey: ["shopping-list-items", vars.storeId],
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
 * Hook to update a store's household association
 */
export function useUpdateStoreHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; householdId: string | null }) =>
            storeSharingApi.updateStoreHousehold(params.storeId, params.householdId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["store", variables.storeId] });
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            if (variables.householdId) {
                showSuccess("Store shared with household!");
            } else {
                showSuccess("Store is now private");
            }
        },
        onError: (error: Error) => {
            showError(`Failed to update store sharing: ${error.message}`);
        },
    });
}

/**
 * Hook to update a store's visibility (hide/show)
 */
export function useUpdateStoreVisibility() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; isHidden: boolean }) =>
            storeSharingApi.updateStoreVisibility(params.storeId, params.isHidden),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["store", variables.storeId] });
            queryClient.invalidateQueries({ queryKey: ["stores"] });
            if (variables.isHidden) {
                showSuccess("Store hidden from lists");
            } else {
                showSuccess("Store is now visible");
            }
        },
        onError: (error: Error) => {
            showError(`Failed to update store visibility: ${error.message}`);
        },
    });
}

// ============================================================================
// Household Management Hooks
// ============================================================================

/**
 * Hook to get all households the current user is a member of
 */
export function useHouseholds() {
    return useTanstackQuery({
        queryKey: ["households"],
        queryFn: householdApi.getUserHouseholds,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status) {
                // Don't retry 4xx errors except timeout/rate-limit
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to get household details with members
 */
export function useHouseholdDetail(householdId: string | null) {
    return useTanstackQuery({
        queryKey: ["household", householdId],
        queryFn: () => {
            if (!householdId) throw new Error("Household ID is required");
            return householdApi.getHouseholdWithMembers(householdId);
        },
        enabled: !!householdId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status === 404) {
                // Don't retry 404s - household was deleted
                return false;
            }
            if (error instanceof ApiError && error.status) {
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to get pending invitations for the current user
 */
export function usePendingInvitations() {
    return useTanstackQuery({
        queryKey: ["invitations"],
        queryFn: invitationApi.getUserPendingInvitations,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status) {
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to create a new household
 */
export function useCreateHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (name: string) => householdApi.createHousehold(name),
        onSuccess: (household) => {
            queryClient.invalidateQueries({ queryKey: ["households"] });
            showSuccess(`Household "${household.name}" created!`);
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to update a household's name
 */
export function useUpdateHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; name: string }) =>
            householdApi.updateHousehold(params.householdId, params.name),
        onSuccess: (household) => {
            queryClient.invalidateQueries({ queryKey: ["household", household.id] });
            queryClient.invalidateQueries({ queryKey: ["households"] });
            showSuccess("Household updated!");
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to delete a household
 */
export function useDeleteHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (householdId: string) => householdApi.deleteHousehold(householdId),
        onSuccess: (_, householdId) => {
            queryClient.invalidateQueries({ queryKey: ["household", householdId] });
            queryClient.invalidateQueries({ queryKey: ["households"] });
            queryClient.invalidateQueries({ queryKey: ["stores"] }); // Stores may be affected
            showSuccess("Household deleted");
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to invite a member to a household
 */
export function useInviteMember() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; email: string }) =>
            householdApi.createInvitation(params.householdId, params.email),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["household", variables.householdId] });
            showSuccess(`Invitation sent to ${variables.email}`);
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to remove a member from a household
 */
export function useRemoveMember() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; userId: string }) =>
            householdApi.removeMember(params.householdId, params.userId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["household", variables.householdId] });
            showSuccess("Member removed");
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to accept a household invitation
 */
export function useAcceptInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (token: string) => invitationApi.acceptInvitation(token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invitations"] });
            queryClient.invalidateQueries({ queryKey: ["households"] });
            showSuccess("Invitation accepted!");
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to decline a household invitation
 */
export function useDeclineInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (token: string) => invitationApi.declineInvitation(token),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invitations"] });
            showSuccess("Invitation declined");
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}

/**
 * Hook to get pending invitations for a household
 */
export function useHouseholdInvitations(householdId: string | null) {
    return useTanstackQuery({
        queryKey: ["household", householdId, "invitations"],
        queryFn: () => {
            if (!householdId) throw new Error("Household ID is required");
            return householdApi.getHouseholdInvitations(householdId);
        },
        enabled: !!householdId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status) {
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to cancel/retract a pending invitation
 */
export function useCancelInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; invitationId: string }) =>
            householdApi.cancelInvitation(params.householdId, params.invitationId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["household", variables.householdId, "invitations"],
            });
            showSuccess("Invitation cancelled");
        },
        onError: (error: Error) => {
            showError(formatErrorMessage(error));
        },
    });
}
