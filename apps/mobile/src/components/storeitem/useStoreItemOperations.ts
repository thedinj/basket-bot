import { useCallback } from "react";
import {
    useRemoveShoppingListItem,
    useToggleFavorite,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import type { StoreItemWithDetails } from "../../db/types";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api/client";

/**
 * Shared hook for store item operations (favorite, add/remove from shopping list)
 * Provides consistent behavior and error handling across StoreItemsPage and FavoritesModal
 */
export const useStoreItemOperations = (storeId: string) => {
    const toggleFavorite = useToggleFavorite();
    const upsertShoppingListItem = useUpsertShoppingListItem();
    const removeShoppingListItem = useRemoveShoppingListItem();
    const { showSuccess, showWarning, showError } = useToast();

    const handleToggleFavorite = useCallback(
        async (item: StoreItemWithDetails) => {
            try {
                await toggleFavorite.mutateAsync({
                    id: item.id,
                    storeId: storeId,
                });
            } catch (error) {
                console.error("[useStoreItemOperations] toggleFavorite error:", error);
                if (error instanceof ApiError && error.isNetworkError) {
                    showWarning("No connection — will retry favorite update automatically");
                } else {
                    showError("Failed to update favorite");
                }
            }
        },
        [storeId, showWarning, showError, toggleFavorite]
    );

    const handleAddToShoppingList = useCallback(
        async (item: StoreItemWithDetails) => {
            try {
                await upsertShoppingListItem.mutateAsync({
                    storeId: storeId,
                    storeItemId: item.id,
                });
                showSuccess("Added to shopping list", { position: "bottom" });
            } catch (error) {
                console.error("[useStoreItemOperations] addToShoppingList error:", error);
                if (error instanceof ApiError && error.isNetworkError) {
                    showWarning("No connection — will add to shopping list automatically once reconnected", {
                        position: "bottom",
                    });
                } else {
                    showError("Failed to add to shopping list");
                }
            }
        },
        [storeId, upsertShoppingListItem, showSuccess, showWarning, showError]
    );

    const handleRemoveFromShoppingList = useCallback(
        async (shoppingListItemId: string) => {
            try {
                await removeShoppingListItem.mutateAsync({
                    id: shoppingListItemId,
                    storeId: storeId,
                });
                showSuccess("Removed from shopping list");
            } catch (error) {
                console.error("[useStoreItemOperations] removeFromShoppingList error:", error);
                if (error instanceof ApiError && error.isNetworkError) {
                    showWarning("No connection — will remove from shopping list automatically once reconnected");
                } else {
                    showError("Failed to remove from shopping list");
                }
            }
        },
        [removeShoppingListItem, showWarning, showError, showSuccess, storeId]
    );

    return {
        handleToggleFavorite,
        handleAddToShoppingList,
        handleRemoveFromShoppingList,
    };
};
