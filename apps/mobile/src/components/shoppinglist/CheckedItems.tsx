import { ShoppingListItemWithDetails } from "../../models/Store";
import { GroupedShoppingList } from "./GroupedShoppingList";

interface CheckedItemsProps {
    items: ShoppingListItemWithDetails[];
    onClearChecked: () => void;
    isClearing: boolean;
    isFadingOut?: boolean;
}

export const CheckedItems = ({
    items,
    onClearChecked,
    isClearing,
    isFadingOut,
}: CheckedItemsProps) => {
    return (
        <div
            style={{
                opacity: isFadingOut ? 0 : 1,
                transition: "opacity 0.5s ease-out",
            }}
        >
            <GroupedShoppingList
                items={items}
                isChecked={true}
                onClearChecked={onClearChecked}
                isClearing={isClearing}
            />
        </div>
    );
};
