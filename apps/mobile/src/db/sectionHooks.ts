import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import pluralize from "pluralize";
import { useCallback } from "react";
import { useShield } from "../components/shield/useShield";
import { useToast } from "../hooks/useToast";
import { useDatabase } from "./hooksShared";
import { queryKeys } from "./queryKeys";

// ============================================================================
// StoreSection Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch all sections for a store
 */
export function useStoreSections(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.sections.byStore(storeId),
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
        queryKey: queryKeys.sections.detail(id),
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
        meta: { operation: "create section" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.sections.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to update a section
 */
export function useUpdateSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();

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
        meta: { operation: "update section" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.sections.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.sections.detail(variables.id),
            });
            // Invalidate store items since they display section names
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            // Invalidate shopping list items since they display section names and order
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to delete a section
 */
export function useDeleteSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ storeId, id }: { id: string; storeId: string }) =>
            database.deleteSection(storeId, id),
        meta: { operation: "delete section" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.sections.byStore(variables.storeId),
            });
            // Invalidate store items and shopping list since section was deleted
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to move a section to a different aisle and update sort orders
 */
export function useMoveSection() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        meta: { operation: "move section" },
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
                queryKey: queryKeys.sections.byStore(variables.storeId),
            });
            // Invalidate store items since section locations changed
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            // Invalidate shopping list items since they display section order
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to reorder sections
 */
export function useReorderSections() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({
            storeId,
            updates,
        }: {
            storeId: string;
            updates: Array<{ id: string; sortOrder: number }>;
        }) => database.reorderSections(storeId, updates),
        meta: { operation: "reorder sections" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.sections.byStore(variables.storeId),
            });
            // Invalidate shopping list items since they display items in section order
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to bulk replace all aisles and sections for a store with progress tracking
 * Preserves existing aisle/section IDs when matched, updates sort order, creates new ones, and deletes orphans
 * Shows progress via shield and keeps screen awake during operation
 */
export function useBulkApplyAislesAndSections() {
    const database = useDatabase();
    const queryClient = useQueryClient();
    const { showError, showSuccess } = useToast();
    const { raiseShield, lowerShield } = useShield();

    const applyAislesAndSections = useCallback(
        async ({
            storeId,
            aisles,
            sections,
            mode,
        }: {
            storeId: string;
            aisles: Array<{ id?: string; name: string; sortOrder: number }>;
            sections: Array<{
                id?: string;
                aisleName: string;
                name: string;
                sortOrder: number;
            }>;
            mode: "append" | "replace";
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

                // Step 3: Delete orphaned aisles (not in transformed result) — replace mode only
                if (mode === "replace") {
                    raiseShield(shieldId, "Removing orphaned aisles...");
                    for (const existingAisle of existingAisles) {
                        if (!processedAisleIds.has(existingAisle.id)) {
                            try {
                                await database.deleteAisle(storeId, existingAisle.id);
                                aisleDeletedCount++;
                            } catch (error) {
                                console.error(
                                    `Failed to delete aisle "${existingAisle.name}":`,
                                    error
                                );
                                errorCount++;
                            }
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

                // Step 5: Delete orphaned sections (not in transformed result) — replace mode only
                if (mode === "replace") {
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
                }

                // Step 6: Invalidate queries to refresh UI
                queryClient.invalidateQueries({
                    queryKey: queryKeys.aisles.byStore(storeId),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.sections.byStore(storeId),
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

    return { applyAislesAndSections };
}
