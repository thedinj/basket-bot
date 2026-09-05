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

    // Shopping list item ids that AI just assigned an aisle/section to, so rows can shimmer
    // to draw attention to their new location. Cleared automatically after the shimmer plays.
    newlyLocatedIds: Set<string>;
    markAutoLocated: (itemIds: string[]) => void;
}

export const ShoppingListContext = createContext<ShoppingListContextValue | undefined>(undefined);
