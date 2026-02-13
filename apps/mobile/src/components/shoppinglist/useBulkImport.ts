import type { ShoppingListItemInput } from "@basket-bot/core";
import { useQueryClient } from "@tanstack/react-query";
import pluralize from "pluralize";
import { useCallback } from "react";
import {
    useGetOrCreateStoreItem,
    useQuantityUnits,
    useStoreAisles,
    useStoreItems,
    useStoreSections,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import type { ParsedShoppingItem } from "../../llm/features/bulkImport";
import { useAutoCategorize } from "../../llm/features/useAutoCategorize";
import { normalizeItemName, toSentenceCase } from "../../utils/stringUtils";
import { useShield } from "../shield/useShield";

/**
 * Process and validate a unit string against known units.
 * Returns normalized unit ID and quantity, or nulls if unit not recognized.
 */
function processUnit(
    parsedUnit: string | null,
    parsedQuantity: number | null,
    units: Array<{ id: string; abbreviation: string }> | undefined
): { unitId: string | null; quantity: number | null } {
    if (!parsedUnit || !units) {
        return { unitId: null, quantity: parsedQuantity };
    }

    // Normalize: remove punctuation, singularize, lowercase
    const normalizedUnit = pluralize
        .singular(parsedUnit.replace(/[^\w\s]/g, ""))
        .toLowerCase()
        .trim();

    // Find matching unit (case-insensitive)
    const matchingUnit = units.find((u) => u.abbreviation.toLowerCase() === normalizedUnit);

    if (matchingUnit) {
        return { unitId: matchingUnit.id, quantity: parsedQuantity };
    }

    // Unit not recognized, nullify both unit and quantity
    return { unitId: null, quantity: null };
}

/**
 * Hook to handle bulk import of shopping list items
 * - Checks for existing items by name match
 * - Auto-categorizes new items
 * - Creates or updates items in the shopping list
 */
export function useBulkImport(storeId: string) {
    const upsertItem = useUpsertShoppingListItem();
    const getOrCreateStoreItem = useGetOrCreateStoreItem();
    const { data: storeItems } = useStoreItems(storeId);
    const { data: aisles } = useStoreAisles(storeId);
    const { data: sections } = useStoreSections(storeId);
    const { data: units } = useQuantityUnits();
    const autoCategorize = useAutoCategorize();
    const { showError, showSuccess } = useToast();
    const queryClient = useQueryClient();
    const { raiseShield, lowerShield } = useShield();

    const importItems = useCallback(
        async (parsedItems: ParsedShoppingItem[]) => {
            const shieldId = "bulk-import";
            let successCount = 0;
            let errorCount = 0;
            const importedItemIds: string[] = [];

            try {
                for (let i = 0; i < parsedItems.length; i++) {
                    const parsed = parsedItems[i];

                    // Update progress
                    raiseShield(
                        shieldId,
                        `Importing ${i + 1} of ${parsedItems.length} ${pluralize("item", parsedItems.length)}...`
                    );

                    try {
                        // Find existing store item by normalized name (handles singular/plural)
                        const parsedNameNorm = normalizeItemName(parsed.name);
                        const existingItem = storeItems?.find(
                            (item) => item.nameNorm === parsedNameNorm
                        );

                        let itemId: string;
                        let aisleId: string | null = null;
                        let sectionId: string | null = null;

                        if (existingItem) {
                            // Use existing item
                            itemId = existingItem.id;
                            aisleId = existingItem.aisleId;
                            sectionId = existingItem.sectionId;
                        } else {
                            // Try auto-categorization for new items
                            if (aisles && aisles.length > 0) {
                                try {
                                    const categorization = await autoCategorize({
                                        itemName: parsed.name,
                                        fullAisles: aisles,
                                        fullSections: sections || [],
                                    });
                                    aisleId = categorization.aisleId;
                                    sectionId = categorization.sectionId;
                                } catch {
                                    // Auto-categorization failed, continue without categories
                                }
                            }

                            // Create new store item with sentence-case formatting for LLM output
                            const displayName = toSentenceCase(parsed.name);
                            const newItem = await getOrCreateStoreItem.mutateAsync({
                                storeId,
                                name: displayName,
                                aisleId,
                                sectionId,
                            });
                            itemId = newItem.id;
                        }

                        // Process and validate unit
                        const { unitId: processedUnitId, quantity: processedQty } = processUnit(
                            parsed.unit,
                            parsed.quantity,
                            units
                        );

                        // Create shopping list item
                        const shoppingListItem: ShoppingListItemInput = {
                            storeItemId: itemId,
                            storeId: storeId,
                            qty: processedQty,
                            unitId: processedUnitId,
                            notes: parsed.notes,
                        };

                        const result = await upsertItem.mutateAsync(shoppingListItem);
                        importedItemIds.push(result.id);
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to import item "${parsed.name}":`, error);
                        errorCount++;
                    }
                }

                // Invalidate queries to refresh the list
                queryClient.invalidateQueries({
                    queryKey: ["shopping-list-items", storeId],
                });

                if (successCount > 0) {
                    showSuccess(
                        `Added ${successCount} item${successCount > 1 ? "s" : ""} to your cart`
                    );
                }

                if (errorCount > 0) {
                    showError(`Failed to import ${errorCount} item${errorCount > 1 ? "s" : ""}`);
                }
            } catch (error) {
                showError(error instanceof Error ? error.message : "Failed to import items");
            } finally {
                lowerShield(shieldId);
            }
        },
        [
            aisles,
            autoCategorize,
            getOrCreateStoreItem,
            queryClient,
            raiseShield,
            lowerShield,
            sections,
            showError,
            showSuccess,
            storeId,
            storeItems,
            units,
            upsertItem,
        ]
    );

    return { importItems };
}
