import { useMemo } from "react";
import { useShoppingListItems } from "../../db/hooks";

/**
 * Creates a map of storeItemId -> shoppingListItemId for quick lookups
 * Used to determine if a store item is already in the shopping list
 */
export const useShoppingListItemMap = (storeId: string) => {
    const { data: shoppingListItems } = useShoppingListItems(storeId);

    const shoppingListItemMap = useMemo(() => {
        const map = new Map<string, string>();
        if (shoppingListItems) {
            for (const item of shoppingListItems) {
                // Skip ideas (they have null storeItemId)
                if (item.storeItemId) {
                    map.set(item.storeItemId, item.id);
                }
            }
        }
        return map;
    }, [shoppingListItems]);

    return shoppingListItemMap;
};
