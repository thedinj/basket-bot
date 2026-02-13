/**
 * Hook for batch auto-categorization of multiple items
 */

import type { StoreAisle, StoreSection } from "@basket-bot/core";
import { useCallback } from "react";
import { useShield } from "../../components/shield/useShield";
import { useDatabase } from "../../db/hooks";
import { useAutoCategorize } from "./useAutoCategorize";

interface ItemToCategorize {
    id: string; // storeItemId
    name: string;
}

interface BatchAutoCategorizeResult {
    successCount: number;
    failureCount: number;
    errors: Error[];
}

/**
 * Hook that provides batch auto-categorization functionality.
 * Categorizes multiple items sequentially, showing progress in the Shield overlay.
 */
export function useBatchAutoCategorize() {
    const autoCategorize = useAutoCategorize();
    const database = useDatabase();
    const { raiseShield, lowerShield } = useShield();

    const batchAutoCategorize = useCallback(
        async (
            items: ItemToCategorize[],
            storeId: string,
            fullAisles: StoreAisle[],
            fullSections: StoreSection[]
        ): Promise<BatchAutoCategorizeResult> => {
            const shieldId = "batch-auto-categorize";
            const errors: Error[] = [];
            let successCount = 0;
            let failureCount = 0;

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
                        });

                        // Update the store item with the categorization result
                        await database.updateItem(
                            storeId,
                            item.id,
                            item.name,
                            result.aisleId,
                            result.sectionId
                        );

                        successCount++;
                    } catch (error) {
                        // Log error and continue with remaining items
                        failureCount++;
                        const errorObj =
                            error instanceof Error ? error : new Error(String(error));
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
                    errors,
                };
            } finally {
                // Always lower the batch shield
                lowerShield(shieldId);
            }
        },
        [autoCategorize, database, raiseShield, lowerShield]
    );

    return batchAutoCategorize;
}
