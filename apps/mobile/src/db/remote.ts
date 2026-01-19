import type {
    AppSetting,
    QuantityUnit,
    ShoppingListItem,
    ShoppingListItemInput,
    ShoppingListItemWithDetails,
    Store,
    StoreAisle,
    StoreItem,
    StoreItemWithDetails,
    StoreSection,
} from "@basket-bot/core";
import { apiClient } from "../lib/api/client";
import { BaseDatabase } from "./base";

/**
 * Remote database implementation that connects to backend API.
 * Maps all Database interface methods to API calls.
 */
export class RemoteDatabase extends BaseDatabase {
    protected async initializeStorage(): Promise<void> {
        // No local storage initialization needed - API is always ready
        // Just notify that we're ready
        this.notifyChange();
    }

    async close(): Promise<void> {
        // Nothing to close for remote database
    }

    protected async hasStores(): Promise<boolean> {
        // Not used for remote - backend manages seed data
        return true;
    }

    // ========== Store Operations ==========
    async insertStore(name: string): Promise<Store> {
        const response = await apiClient.post<{ store: Store }>("/api/stores", {
            name,
        });
        this.notifyChange();
        return response.store;
    }

    async loadAllStores(): Promise<Store[]> {
        const response = await apiClient.get<{ stores: Store[] }>("/api/stores");
        return response.stores;
    }

    async getStoreById(id: string): Promise<Store | null> {
        try {
            const response = await apiClient.get<{ store: Store }>(`/api/stores/${id}`);
            return response.store;
        } catch {
            return null;
        }
    }

    async updateStore(id: string, name: string): Promise<Store> {
        const response = await apiClient.put<{ store: Store }>(`/api/stores/${id}`, { name });
        this.notifyChange();
        return response.store;
    }

    async deleteStore(id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${id}`);
        this.notifyChange();
    }

    // ========== App Settings Operations ==========
    async getAppSetting(_key: string): Promise<AppSetting | null> {
        // App settings are not yet implemented in backend API
        // Return null for now or implement if needed
        return null;
    }

    async setAppSetting(_key: string, _value: string): Promise<void> {
        // App settings are not yet implemented in backend API
        // No-op for now or implement if needed
    }

    // ========== Quantity Unit Operations ==========
    async loadAllQuantityUnits(): Promise<QuantityUnit[]> {
        const response = await apiClient.get<{ units: QuantityUnit[] }>("/api/quantity-units");
        return response.units;
    }

    // ========== StoreAisle Operations ==========
    async insertAisle(storeId: string, name: string): Promise<StoreAisle> {
        const response = await apiClient.post<{ aisle: StoreAisle }>(
            `/api/stores/${storeId}/aisles`,
            { name }
        );
        this.notifyChange();
        return response.aisle;
    }

    async getAislesByStore(storeId: string): Promise<StoreAisle[]> {
        const response = await apiClient.get<{ aisles: StoreAisle[] }>(
            `/api/stores/${storeId}/aisles`
        );
        return response.aisles;
    }

    async updateAisle(storeId: string, id: string, name: string): Promise<StoreAisle> {
        const response = await apiClient.put<{ aisle: StoreAisle }>(
            `/api/stores/${storeId}/aisles/${id}`,
            { name }
        );
        this.notifyChange();
        return response.aisle;
    }

    async deleteAisle(storeId: string, id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${storeId}/aisles/${id}`);
        this.notifyChange();
    }

    async reorderAisles(
        storeId: string,
        updates: Array<{ id: string; sortOrder: number }>
    ): Promise<void> {
        await apiClient.post(`/api/stores/${storeId}/aisles/reorder`, { updates });
        this.notifyChange();
    }

    // ========== StoreSection Operations ==========
    async insertSection(storeId: string, name: string, aisleId: string): Promise<StoreSection> {
        const response = await apiClient.post<{ section: StoreSection }>(
            `/api/stores/${storeId}/sections`,
            { name, aisleId }
        );
        this.notifyChange();
        return response.section;
    }

    async getSectionsByStore(storeId: string): Promise<StoreSection[]> {
        const response = await apiClient.get<{ sections: StoreSection[] }>(
            `/api/stores/${storeId}/sections`
        );
        return response.sections;
    }

    async getSectionById(_id: string): Promise<StoreSection | null> {
        // Same issue as aisles - need storeId
        return null;
    }

    async updateSection(
        storeId: string,
        id: string,
        name: string,
        aisleId: string
    ): Promise<StoreSection> {
        const response = await apiClient.put<{ section: StoreSection }>(
            `/api/stores/${storeId}/sections/${id}`,
            { name, aisleId }
        );
        this.notifyChange();
        return response.section;
    }

    async deleteSection(storeId: string, id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${storeId}/sections/${id}`);
        this.notifyChange();
    }

    async reorderSections(
        storeId: string,
        updates: Array<{ id: string; sortOrder: number }>
    ): Promise<void> {
        await apiClient.post(`/api/stores/${storeId}/sections/reorder`, { updates });
        this.notifyChange();
    }

    // ========== StoreItem Operations ==========
    async insertItem(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const response = await apiClient.post<{ item: StoreItem }>(`/api/stores/${storeId}/items`, {
            name,
            aisleId,
            sectionId,
        });
        this.notifyChange();
        return response.item;
    }

    async getItemsByStore(storeId: string): Promise<StoreItem[]> {
        const response = await apiClient.get<{ items: StoreItem[] }>(
            `/api/stores/${storeId}/items`
        );
        return response.items;
    }

    async getItemsByStoreWithDetails(storeId: string): Promise<StoreItemWithDetails[]> {
        const response = await apiClient.get<{ items: StoreItemWithDetails[] }>(
            `/api/stores/${storeId}/items`
        );
        return response.items;
    }

    async getItemById(_id: string): Promise<StoreItem | null> {
        // Same storeId issue
        return null;
    }

    async updateItem(
        storeId: string,
        id: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const response = await apiClient.put<{ item: StoreItem }>(
            `/api/stores/${storeId}/items/${id}`,
            { name, aisleId, sectionId }
        );
        this.notifyChange();
        return response.item;
    }

    async toggleItemFavorite(_id: string): Promise<StoreItem> {
        throw new Error(
            "toggleItemFavorite requires storeId - use toggleItemFavoriteForStore instead"
        );
    }

    async deleteItem(_id: string): Promise<void> {
        throw new Error("deleteItem requires storeId - use deleteItemForStore instead");
    }

    async searchStoreItems(
        storeId: string,
        searchTerm: string,
        limit: number = 20
    ): Promise<StoreItem[]> {
        const response = await apiClient.get<{ items: StoreItem[] }>(
            `/api/stores/${storeId}/items/search?q=${encodeURIComponent(searchTerm)}&limit=${limit}`
        );
        return response.items;
    }

    async getOrCreateStoreItemByName(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        // Backend's getOrCreateStoreItemByName is not exposed as a separate endpoint
        // It's used internally by upsertShoppingListItem
        // For now, search first, then create if not found
        const searchResults = await this.searchStoreItems(storeId, name, 1);
        const exactMatch = searchResults.find(
            (item) => item.name.toLowerCase() === name.toLowerCase()
        );

        if (exactMatch) {
            return exactMatch;
        }

        return this.insertItem(storeId, name, aisleId, sectionId);
    }

    async toggleItemFavoriteForStore(storeId: string, id: string): Promise<StoreItem> {
        const response = await apiClient.post<{ item: StoreItem }>(
            `/api/stores/${storeId}/items/${id}/favorite`,
            {}
        );
        this.notifyChange();
        return response.item;
    }

    async deleteItemForStore(storeId: string, id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${storeId}/items/${id}`);
        this.notifyChange();
    }

    // ========== ShoppingList Operations ==========
    async getShoppingListItems(storeId: string): Promise<ShoppingListItemWithDetails[]> {
        try {
            const response = await apiClient.get<{ items: ShoppingListItemWithDetails[] }>(
                `/api/stores/${storeId}/shopping-list`
            );
            return response.items;
        } catch (error) {
            console.error("[RemoteDatabase] getShoppingListItems error:", error);
            throw error;
        }
    }

    async upsertShoppingListItem(params: ShoppingListItemInput): Promise<ShoppingListItem> {
        const response = await apiClient.post<{ item: ShoppingListItem }>(
            `/api/stores/${params.storeId}/shopping-list`,
            params
        );
        this.notifyChange();
        return response.item;
    }

    async toggleShoppingListItemChecked(
        storeId: string,
        id: string,
        isChecked: boolean
    ): Promise<void> {
        await apiClient.post(`/api/stores/${storeId}/shopping-list/${id}/toggle`, { isChecked });
        this.notifyChange();
    }

    /**
     * Delete shopping list item AND the associated store item
     */
    async deleteShoppingListItem(storeId: string, id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${storeId}/shopping-list/${id}/delete-with-item`);
        this.notifyChange();
    }

    /**
     * Remove shopping list item only (keeps the store item)
     */
    async removeShoppingListItem(storeId: string, id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${storeId}/shopping-list/${id}`);
        this.notifyChange();
    }

    async clearCheckedShoppingListItems(storeId: string): Promise<void> {
        await apiClient.post(`/api/stores/${storeId}/shopping-list/clear-checked`, {});
        this.notifyChange();
    }
}
