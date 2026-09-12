/**
 * Hook for batch auto-categorization of multiple items
 */

import type { StoreAisle, StoreSection } from "@basket-bot/core";
import { useCallback } from "react";
import { useShield } from "../../components/shield/useShield";
import { useDatabase } from "../../db/hooks";
import { useMergeItems } from "../../db/itemHooks";
import { AUTO_MERGE_CONFIDENCE } from "./itemDedupe";
import { useAutoCategorize, type ExistingStoreItem } from "./useAutoCategorize";

interface ItemToCategorize {
    id: string; // storeItemId
    name: string;
}

interface BatchAutoCategorizeResult {
    successCount: number;
    failureCount: number;
    /** How many of the successes turned out to be duplicates and were folded into another item. */
    mergedCount: number;
    errors: Error[];
    /**
     * storeItemIds that were successfully categorized, so callers can highlight them. For a
     * merged item this is the *survivor's* id — the loser no longer exists and the shopping
     * list rows now point at the winner.
     */
    succeededIds: string[];
}

/**
 * Hook that provides batch auto-categorization functionality.
 * Categorizes multiple items sequentially, showing progress in the Shield overlay.
 *
 * Once an item's aisle/section is known it is also checked against what already lives there:
 * a confident duplicate ("Mozzarella, shredded" where "Shredded mozzarella" already exists) is
 * merged instead of being filed alongside its twin. Only a confident match merges — below the
 * threshold the item is simply categorized, since a silent wrong merge costs more than a
 * duplicate row.
 */
export function useBatchAutoCategorize() {
    const autoCategorize = useAutoCategorize();
    const mergeItems = useMergeItems();
    const database = useDatabase();
    const { raiseShield, lowerShield } = useShield();

    const batchAutoCategorize = useCallback(
        async (
            items: ItemToCategorize[],
            storeId: string,
            fullAisles: StoreAisle[],
            fullSections: StoreSection[],
            existingItems: ExistingStoreItem[] = []
        ): Promise<BatchAutoCategorizeResult> => {
            const shieldId = "batch-auto-categorize";
            const errors: Error[] = [];
            const succeededIds: string[] = [];
            let successCount = 0;
            let failureCount = 0;
            let mergedCount = 0;

            // Merging deletes the loser, so the candidate pool has to shrink as we go —
            // otherwise a later item could be told to merge into a row that no longer exists.
            let candidates = existingItems;

            try {
                const totalItems = items.length;

                for (let i = 0; i < totalItems; i++) {
                    const item = items[i];
                    const current = i + 1;

                    // Update shield message with progress
                    raiseShield(shieldId, `Categorizing ${current}/${totalItems} items...`);

                    try {
                        // Call LLM to categorize (already handles its own shield internally)
                        const result = await autoCategorize({
                            itemName: item.name,
                            fullAisles,
                            fullSections,
                            existingItems: candidates,
                            excludeItemId: item.id,
                        });

                        const duplicate = result.duplicateOf;

                        if (duplicate && duplicate.confidence >= AUTO_MERGE_CONFIDENCE) {
                            const survivor = await mergeItems.mutateAsync({
                                storeId,
                                id: item.id,
                                intoItemId: duplicate.existing.id,
                                canonicalName: duplicate.canonicalName,
                            });

                            candidates = candidates.filter((candidate) => candidate.id !== item.id);
                            mergedCount++;
                            successCount++;
                            succeededIds.push(survivor.id);
                            continue;
                        }

                        // Update the store item with the categorization result
                        await database.updateItem(
                            storeId,
                            item.id,
                            item.name,
                            result.aisleId,
                            result.sectionId
                        );

                        successCount++;
                        succeededIds.push(item.id);
                    } catch (error) {
                        // Log error and continue with remaining items
                        failureCount++;
                        const errorObj = error instanceof Error ? error : new Error(String(error));
                        errors.push(errorObj);
                        console.error(
                            `[useBatchAutoCategorize] Failed to categorize item "${item.name}":`,
                            errorObj
                        );
                    }
                }

                return {
                    successCount,
                    failureCount,
                    mergedCount,
                    errors,
                    succeededIds,
                };
            } finally {
                // Always lower the batch shield
                lowerShield(shieldId);
            }
        },
        [autoCategorize, mergeItems, database, raiseShield, lowerShield]
    );

    return batchAutoCategorize;
}
