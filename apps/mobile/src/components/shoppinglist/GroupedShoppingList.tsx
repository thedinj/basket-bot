import { useSecureApiKey } from "@/hooks/useSecureStorage";
import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { IonIcon } from "@ionic/react";
import { useQueryClient } from "@tanstack/react-query";
import { bulbOutline, checkmarkDone } from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";
import { useStoreAisles, useStoreSections } from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { useBatchAutoCategorize } from "../../llm/features/useBatchAutoCategorize";
import { LLM_ICON_SRC } from "../../llm/shared/constants";
import { formatErrorMessage } from "../../utils/errorUtils";
import ActionSlotButton from "../shared/ActionSlotButton";
import { GroupedItemList } from "../shared/GroupedItemList";
import { ItemGroup } from "../shared/grouping.types";
import { createAisleSectionGroups } from "../shared/grouping.utils";
import { ShoppingListItem } from "./ShoppingListItem";

interface GroupedShoppingListProps {
    items: ShoppingListItemWithDetails[];
    onClearChecked?: () => void;
    isClearing?: boolean;
}

const HEADER_STYLE = {
    fontSize: "0.9rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
} as const;

const INDENT_LEVEL = 16;
const IDEAS_SORT_ORDER = 0;
const AISLE_SORT_ORDER_OFFSET = 100;

const createCheckedItemsGroup = (
    items: ShoppingListItemWithDetails[],
    onClearChecked?: () => void,
    isClearing?: boolean
): ItemGroup<ShoppingListItemWithDetails> => ({
    id: "checked-items",
    items,
    header: {
        label: "Checked Items",
        color: "light",
        sticky: true,
        labelStyle: HEADER_STYLE,
        actionSlot: onClearChecked && (
            <ActionSlotButton
                label="Obliterate"
                icon={checkmarkDone}
                onClick={onClearChecked}
                disabled={isClearing}
            />
        ),
    },
    sortOrder: 0,
    indentLevel: INDENT_LEVEL,
});

const createIdeasGroup = (
    ideas: ShoppingListItemWithDetails[]
): ItemGroup<ShoppingListItemWithDetails> => ({
    id: "ideas",
    items: ideas,
    header: {
        label: (
            <>
                <IonIcon icon={bulbOutline} color="warning" /> Ideas
            </>
        ),
        color: "light",
        sticky: true,
        labelStyle: HEADER_STYLE,
    },
    sortOrder: IDEAS_SORT_ORDER,
    indentLevel: INDENT_LEVEL,
});

export const GroupedShoppingList = ({
    items,
    onClearChecked,
    isClearing,
}: GroupedShoppingListProps) => {
    const queryClient = useQueryClient();
    const apiKeyValue = useSecureApiKey();
    const { showToast } = useToast();
    const batchAutoCategorize = useBatchAutoCategorize();
    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);

    // Get storeId from first item (all items in list belong to same store)
    const storeId = items[0]?.storeId;

    // Fetch aisles and sections for auto-categorization
    const { data: aisles = [] } = useStoreAisles(storeId || "");
    const { data: sections = [] } = useStoreSections(storeId || "");

    // Extract uncategorized items that can be categorized
    const getUncategorizedItems = useCallback(() => {
        return items
            .filter((item) => !item.isChecked && !item.isIdea && item.aisleId === null)
            .filter((item) => item.storeItemId !== null && item.itemName?.trim())
            .map((item) => ({
                id: item.storeItemId!,
                name: item.itemName!,
            }));
    }, [items]);

    // Show appropriate toast based on categorization results
    const showResultToast = useCallback(
        (result: { successCount: number; failureCount: number; errors: Error[] }) => {
            if (result.failureCount === 0) {
                showToast({
                    message: `Successfully categorized ${result.successCount} items`,
                    type: "success",
                });
            } else if (result.successCount > 0) {
                showToast({
                    message: `Categorized ${result.successCount} items (${result.failureCount} failed)`,
                    type: "warning",
                });
            } else {
                const uniqueMessages = [...new Set(result.errors.map((e) => e.message))];
                const errorMessage =
                    uniqueMessages.length === 1
                        ? `Failed to categorize items: ${uniqueMessages[0]}`
                        : "Failed to categorize items. Please try again.";
                showToast({ message: errorMessage, type: "error" });
            }
        },
        [showToast]
    );

    // Refresh queries after successful categorization
    const refreshAfterCategorization = useCallback(async () => {
        if (!storeId) return;
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["shopping-list-items", storeId] }),
            queryClient.invalidateQueries({ queryKey: ["items", storeId] }),
            queryClient.invalidateQueries({ queryKey: ["items", "with-details", storeId] }),
        ]);
        await queryClient.refetchQueries({ queryKey: ["shopping-list-items", storeId] });
    }, [storeId, queryClient]);

    // Handler for auto-categorizing all uncategorized items
    const handleAutoCategorizeAll = useCallback(async () => {
        if (!storeId) return;

        const uncategorizedItems = getUncategorizedItems();
        if (uncategorizedItems.length === 0) {
            showToast({ message: "No uncategorized items to process", type: "info" });
            return;
        }

        setIsAutoCategorizing(true);
        try {
            const result = await batchAutoCategorize(uncategorizedItems, storeId, aisles, sections);
            await refreshAfterCategorization();
            showResultToast(result);
        } catch (error: unknown) {
            showToast({ message: `Error: ${formatErrorMessage(error)}`, type: "error" });
        } finally {
            setIsAutoCategorizing(false);
        }
    }, [
        storeId,
        aisles,
        sections,
        getUncategorizedItems,
        batchAutoCategorize,
        refreshAfterCategorization,
        showResultToast,
        showToast,
    ]);

    const groups = useMemo(() => {
        const itemGroups: ItemGroup<ShoppingListItemWithDetails>[] = [];

        // Partition items by checked status
        const checkedItems = items.filter((item) => item.isChecked);
        const uncheckedItems = items.filter((item) => !item.isChecked);

        // Add checked items group if any exist
        if (checkedItems.length > 0) {
            itemGroups.push(createCheckedItemsGroup(checkedItems, onClearChecked, isClearing));
        }

        // Process unchecked items
        if (uncheckedItems.length > 0) {
            const ideas = uncheckedItems.filter((item) => item.isIdea);
            const regularItems = uncheckedItems.filter((item) => !item.isIdea);

            // Add ideas group
            if (ideas.length > 0) {
                itemGroups.push(createIdeasGroup(ideas));
            }

            // Add aisle/section groups for regular items
            const aisleGroups = createAisleSectionGroups(regularItems, {
                showAisleHeaders: true,
                showSectionHeaders: true,
                sortOrderOffset: AISLE_SORT_ORDER_OFFSET,
            });

            // Inject auto-categorize button for uncategorized aisle
            const uncategorizedGroup = aisleGroups.find((g) => g.id === "aisle-null");
            const hasUncategorizedItems = uncategorizedGroup && uncategorizedGroup.children;
            const uncategorizedCount = hasUncategorizedItems
                ? uncategorizedGroup.children!.reduce(
                      (sum, section) => sum + section.items.length,
                      0
                  )
                : 0;

            if (
                apiKeyValue &&
                aisles.length > 0 &&
                uncategorizedGroup &&
                uncategorizedCount > 0 &&
                uncategorizedGroup.header
            ) {
                uncategorizedGroup.header.actionSlot = (
                    <ActionSlotButton
                        label="Auto-Categorize"
                        iconSrc={LLM_ICON_SRC}
                        onClick={handleAutoCategorizeAll}
                        disabled={isAutoCategorizing}
                    />
                );
            }

            itemGroups.push(...aisleGroups);
        }

        return itemGroups;
    }, [
        aisles,
        apiKeyValue,
        handleAutoCategorizeAll,
        isAutoCategorizing,
        isClearing,
        items,
        onClearChecked,
    ]);

    const getItemKey = useCallback((item: ShoppingListItemWithDetails) => item.id, []);

    if (items.length === 0) {
        return null;
    }

    return (
        <GroupedItemList<ShoppingListItemWithDetails>
            groups={groups}
            renderItem={(item) => <ShoppingListItem item={item} isChecked={item.isChecked} />}
            getItemKey={getItemKey}
        />
    );
};
