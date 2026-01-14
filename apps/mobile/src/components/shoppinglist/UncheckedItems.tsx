import { ShoppingListItemWithDetails } from "../../models/Store";
import { GroupedShoppingList } from "./GroupedShoppingList";

interface UncheckedItemsProps {
    items: ShoppingListItemWithDetails[];
}

export const UncheckedItems = ({ items }: UncheckedItemsProps) => {
    return <GroupedShoppingList items={items} isChecked={false} />;
};
