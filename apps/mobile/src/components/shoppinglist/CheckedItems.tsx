import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import clsx from "clsx";
import { GroupedShoppingList } from "./GroupedShoppingList";

import "./CheckedItems.scss";

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
            className={clsx(
                "checked-items-wrapper",
                isFadingOut && "checked-items-wrapper--fading"
            )}
        >
            <GroupedShoppingList
                items={items}
                onClearChecked={onClearChecked}
                isClearing={isClearing}
            />
        </div>
    );
};
