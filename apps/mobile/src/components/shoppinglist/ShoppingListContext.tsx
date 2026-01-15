import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { createContext } from "react";

export interface ShoppingListContextValue {
    // Selected store
    selectedStoreId: string | null;
    setSelectedStoreId: (storeId: string | null) => void;

    // Modal states
    isItemModalOpen: boolean;
    editingItem: ShoppingListItemWithDetails | null;
    openCreateModal: () => void;
    openEditModal: (item: ShoppingListItemWithDetails) => void;
    closeItemModal: () => void;

    // Delete confirmation
    deleteAlert: { id: string; name: string } | null;
    confirmDelete: (id: string, name: string) => void;
    cancelDelete: () => void;
    executeDelete: () => void;

    // Newly imported items (for shimmer animation)
    newlyImportedItemIds: Set<string>;
    markAsNewlyImported: (itemIds: string[]) => void;
}

export const ShoppingListContext = createContext<ShoppingListContextValue | undefined>(undefined);
