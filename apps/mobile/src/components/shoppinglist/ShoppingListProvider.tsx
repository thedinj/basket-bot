import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { ReactNode, useMemo, useState } from "react";
import { useDeleteShoppingListItem, useStores } from "../../db/hooks";
import { useLastShoppingListStore } from "../../hooks/useLastShoppingListStore";
import { ShoppingListContext, ShoppingListContextValue } from "./ShoppingListContext";

interface ShoppingListProviderProps {
    children: ReactNode;
}

export const ShoppingListProvider = ({ children }: ShoppingListProviderProps) => {
    const [userSelectedStoreId, setUserSelectedStoreId] = useState<string | null>(null);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ShoppingListItemWithDetails | null>(null);
    const [deleteAlert, setDeleteAlert] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [newlyImportedItemIds, setNewlyImportedItemIds] = useState<Set<string>>(new Set());

    const deleteItemMutation = useDeleteShoppingListItem();
    const { data: stores } = useStores();
    const { lastShoppingListStoreId, saveLastShoppingListStore } = useLastShoppingListStore();

    // Compute selected store ID from stores data - React will re-render when stores change
    const selectedStoreId = useMemo(() => {
        // User explicitly selected a store
        if (userSelectedStoreId) {
            return userSelectedStoreId;
        }

        // No stores loaded yet
        if (!stores) {
            return null;
        }

        // Restore last selected store if it still exists
        if (lastShoppingListStoreId) {
            const exists = stores.some((s) => s.id === lastShoppingListStoreId);
            if (exists) {
                return lastShoppingListStoreId;
            }
        }

        // Auto-select if exactly one store
        if (stores.length === 1) {
            return stores[0].id;
        }

        // No store to select
        return null;
    }, [stores, userSelectedStoreId, lastShoppingListStoreId]);

    const openCreateModal = () => {
        setEditingItem(null);
        setIsItemModalOpen(true);
    };

    const openEditModal = (item: ShoppingListItemWithDetails) => {
        setEditingItem(item);
        setIsItemModalOpen(true);
    };

    const closeItemModal = () => {
        setIsItemModalOpen(false);
        setEditingItem(null);
    };

    const confirmDelete = (id: string, name: string) => {
        setDeleteAlert({ id, name });
    };

    const cancelDelete = () => {
        setDeleteAlert(null);
    };

    const executeDelete = async () => {
        if (deleteAlert && selectedStoreId) {
            await deleteItemMutation.mutateAsync({
                id: deleteAlert.id,
                storeId: selectedStoreId,
            });
            setDeleteAlert(null);
        }
    };

    const markAsNewlyImported = (itemIds: string[]) => {
        setNewlyImportedItemIds(new Set(itemIds));
        // Clear the set after animation completes (2 seconds)
        setTimeout(() => {
            setNewlyImportedItemIds(new Set());
        }, 2000);
    };

    // Wrap setSelectedStoreId to also save preference
    const handleSetSelectedStoreId = (storeId: string | null) => {
        setUserSelectedStoreId(storeId);
        saveLastShoppingListStore(storeId);
    };

    const value: ShoppingListContextValue = {
        selectedStoreId,
        setSelectedStoreId: handleSetSelectedStoreId,
        isItemModalOpen,
        editingItem,
        openCreateModal,
        openEditModal,
        closeItemModal,
        deleteAlert,
        confirmDelete,
        cancelDelete,
        executeDelete,
        newlyImportedItemIds,
        markAsNewlyImported,
    };

    return <ShoppingListContext.Provider value={value}>{children}</ShoppingListContext.Provider>;
};
