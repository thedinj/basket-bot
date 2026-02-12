import { useCallback } from "react";
import {
    useRemoveShoppingListItem,
    useToggleFavorite,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import type { StoreItemWithDetails } from "../../db/types";
import { useToast } from "../../hooks/useToast";

/**
 * Shared hook for store item operations (favorite, add/remove from shopping list)
 * Provides consistent behavior and error handling across StoreItemsPage and FavoritesModal
 */
export const useStoreItemOperations = (storeId: string) => {
    const toggleFavorite = useToggleFavorite();
    const upsertShoppingListItem = useUpsertShoppingListItem();
    const removeShoppingListItem = useRemoveShoppingListItem();
    const { showSuccess, showError } = useToast();

    const handleToggleFavorite = useCallback(
        async (item: StoreItemWithDetails) => {
            try {
                await toggleFavorite.mutateAsync({
                    id: item.id,
                    storeId: storeId,
                });
            } catch {
                showError("Failed to update favorite");
            }
        },
        [storeId, showError, toggleFavorite]
    );

    const handleAddToShoppingList = useCallback(
        async (item: StoreItemWithDetails) => {
            try {
                await upsertShoppingListItem.mutateAsync({
                    storeId: storeId,
                    storeItemId: item.id,
                });
                showSuccess("Added to shopping list");
            } catch {
                showError("Failed to add to shopping list");
            }
        },
        [storeId, upsertShoppingListItem, showSuccess, showError]
    );

    const handleRemoveFromShoppingList = useCallback(
        async (shoppingListItemId: string) => {
            try {
                await removeShoppingListItem.mutateAsync({
                    id: shoppingListItemId,
                    storeId: storeId,
                });
                showSuccess("Removed from shopping list");
            } catch {
                showError("Failed to remove from shopping list");
            }
        },
        [removeShoppingListItem, showError, showSuccess, storeId]
    );

    return {
        handleToggleFavorite,
        handleAddToShoppingList,
        handleRemoveFromShoppingList,
    };
};
