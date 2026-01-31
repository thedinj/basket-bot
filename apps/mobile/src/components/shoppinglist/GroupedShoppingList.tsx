import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { IonButton, IonIcon } from "@ionic/react";
import { bulbOutline, checkmarkDone } from "ionicons/icons";
import { useMemo } from "react";
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
            <IonButton fill="clear" size="small" onClick={onClearChecked} disabled={isClearing}>
                <IonIcon slot="start" icon={checkmarkDone} />
                Obliterate
            </IonButton>
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
            itemGroups.push(...aisleGroups);
        }

        return itemGroups;
    }, [items, onClearChecked, isClearing]);

    if (items.length === 0) {
        return null;
    }

    return (
        <GroupedItemList<ShoppingListItemWithDetails>
            groups={groups}
            renderItem={(item) => (
                <ShoppingListItem key={item.id} item={item} isChecked={item.isChecked} />
            )}
        />
    );
};
