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
import { queryKeys } from "../../db/queryKeys";
import { useToast } from "../../hooks/useToast";
import type { ParsedShoppingItem } from "../../llm/features/bulkImport";
import { AUTO_MERGE_CONFIDENCE } from "../../llm/features/itemDedupe";
import { useAutoCategorize } from "../../llm/features/useAutoCategorize";
import { matchUnitId, normalizeItemName, toSentenceCase } from "../../utils/stringUtils";
import { useShield } from "../shield/useShield";

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
            /** Items that turned out to already exist under a different wording. */
            let mergedCount = 0;
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
                        // Must use the storage normalizer, not the search one: `nameNorm` is
                        // written by the backend and is not singularized, so singularizing here
                        // would miss every plural and create a duplicate store item.
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
                            // No exact `nameNorm` hit, but the item may still already exist under
                            // a different wording ("mozzarella, shredded" vs "Shredded
                            // mozzarella"). Auto-categorization settles the aisle/section first,
                            // which is what makes that a cheap question to ask.
                            let duplicateItemId: string | null = null;

                            if (aisles && aisles.length > 0) {
                                try {
                                    const categorization = await autoCategorize({
                                        itemName: parsed.name,
                                        // The parser is told to put qualifiers in `notes`, so
                                        // "peppers (green)" arrives as name "Peppers" + notes
                                        // "green" — the bare name has lost the word that
                                        // identifies the product. But `notes` is just as often
                                        // a recipe ("for lasagna"), so it is handed over as a
                                        // qualifier for the model to weigh, not pasted onto
                                        // the name where it would silently become identity.
                                        qualifier: parsed.notes,
                                        fullAisles: aisles,
                                        fullSections: sections || [],
                                        existingItems: storeItems,
                                    });
                                    aisleId = categorization.aisleId;
                                    sectionId = categorization.sectionId;

                                    const duplicate = categorization.duplicateOf;
                                    if (
                                        duplicate &&
                                        duplicate.confidence >= AUTO_MERGE_CONFIDENCE
                                    ) {
                                        duplicateItemId = duplicate.existing.id;
                                    }
                                } catch {
                                    // Auto-categorization failed, continue without categories
                                }
                            }

                            if (duplicateItemId) {
                                // Reuse the row that already exists rather than adding a second
                                // spelling of the same product. Its location is left alone.
                                itemId = duplicateItemId;
                                mergedCount++;
                            } else {
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
                        }

                        // Process and validate unit; nullify quantity if unit is unrecognized
                        const processedUnitId = matchUnitId(parsed.unit, units);
                        const processedQty =
                            parsed.unit && !processedUnitId ? null : parsed.quantity;

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
                    queryKey: queryKeys.shoppingListItems.byStore(storeId),
                });

                if (successCount > 0) {
                    showSuccess(
                        `Added ${pluralize("item", successCount, true)} to your cart` +
                            (mergedCount > 0 ? ` (${mergedCount} matched existing items)` : "")
                    );
                }

                if (errorCount > 0) {
                    showError(`Failed to import ${pluralize("item", errorCount, true)}`);
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
