import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { GroupedShoppingList } from "./GroupedShoppingList";

interface UncheckedItemsProps {
    items: ShoppingListItemWithDetails[];
}

export const UncheckedItems = ({ items }: UncheckedItemsProps) => {
    return <GroupedShoppingList items={items} isChecked={false} />;
};
