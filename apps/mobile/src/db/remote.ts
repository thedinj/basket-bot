import type {
    AppSetting,
    CheckConflictResult,
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
import { apiClient, ApiError } from "../lib/api/client";
import { mutationQueue } from "../lib/mutationQueue";
import { BaseDatabase } from "./base";

/**
 * Remote database implementation that connects to backend API.
 * Maps all Database interface methods to API calls.
 * Automatically queues failed mutations for retry on network errors.
 */
export class RemoteDatabase extends BaseDatabase {
    /**
     * Helper to execute a mutation with automatic queueing on network failure
     */
    private async executeMutation<T>(
        operation: string,
        endpoint: string,
        method: string,
        apiCall: () => Promise<T>,
        data?: unknown
    ): Promise<T> {
        try {
            const result = await apiCall();
            this.notifyChange();
            return result;
        } catch (error) {
            // Queue the mutation if it's a network error
            if (error instanceof ApiError && error.isNetworkError) {
                await mutationQueue.enqueue({
                    operation,
                    endpoint,
                    method,
                    data,
                });
                console.log(`[RemoteDatabase] Queued ${operation} for later retry`);
            }
            // Re-throw the error so calling code can handle it
            throw error;
        }
    }
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
        return this.executeMutation(
            "insertStore",
            "/api/stores",
            "POST",
            async () => {
                const response = await apiClient.post<{ store: Store }>("/api/stores", { name });
                return response.store;
            },
            { name }
        );
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
        return this.executeMutation(
            "updateStore",
            `/api/stores/${id}`,
            "PUT",
            async () => {
                const response = await apiClient.put<{ store: Store }>(`/api/stores/${id}`, {
                    name,
                });
                return response.store;
            },
            { name }
        );
    }

    async deleteStore(id: string): Promise<void> {
        return this.executeMutation("deleteStore", `/api/stores/${id}`, "DELETE", async () => {
            await apiClient.delete(`/api/stores/${id}`);
        });
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
        return this.executeMutation(
            "insertAisle",
            `/api/stores/${storeId}/aisles`,
            "POST",
            async () => {
                const response = await apiClient.post<{ aisle: StoreAisle }>(
                    `/api/stores/${storeId}/aisles`,
                    { name }
                );
                return response.aisle;
            },
            { name }
        );
    }

    async getAislesByStore(storeId: string): Promise<StoreAisle[]> {
        const response = await apiClient.get<{ aisles: StoreAisle[] }>(
            `/api/stores/${storeId}/aisles`
        );
        return response.aisles;
    }

    async updateAisle(storeId: string, id: string, name: string): Promise<StoreAisle> {
        return this.executeMutation(
            "updateAisle",
            `/api/stores/${storeId}/aisles/${id}`,
            "PUT",
            async () => {
                const response = await apiClient.put<{ aisle: StoreAisle }>(
                    `/api/stores/${storeId}/aisles/${id}`,
                    { name }
                );
                return response.aisle;
            },
            { name }
        );
    }

    async deleteAisle(storeId: string, id: string): Promise<void> {
        return this.executeMutation(
            "deleteAisle",
            `/api/stores/${storeId}/aisles/${id}`,
            "DELETE",
            async () => {
                await apiClient.delete(`/api/stores/${storeId}/aisles/${id}`);
            }
        );
    }

    async reorderAisles(
        storeId: string,
        updates: Array<{ id: string; sortOrder: number }>
    ): Promise<void> {
        return this.executeMutation(
            "reorderAisles",
            `/api/stores/${storeId}/aisles/reorder`,
            "POST",
            async () => {
                await apiClient.post(`/api/stores/${storeId}/aisles/reorder`, { updates });
            },
            { updates }
        );
    }

    // ========== StoreSection Operations ==========
    async insertSection(storeId: string, name: string, aisleId: string): Promise<StoreSection> {
        return this.executeMutation(
            "insertSection",
            `/api/stores/${storeId}/sections`,
            "POST",
            async () => {
                const response = await apiClient.post<{ section: StoreSection }>(
                    `/api/stores/${storeId}/sections`,
                    { name, aisleId }
                );
                return response.section;
            },
            { name, aisleId }
        );
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
        return this.executeMutation(
            "updateSection",
            `/api/stores/${storeId}/sections/${id}`,
            "PUT",
            async () => {
                const response = await apiClient.put<{ section: StoreSection }>(
                    `/api/stores/${storeId}/sections/${id}`,
                    { name, aisleId }
                );
                return response.section;
            },
            { name, aisleId }
        );
    }

    async deleteSection(storeId: string, id: string): Promise<void> {
        return this.executeMutation(
            "deleteSection",
            `/api/stores/${storeId}/sections/${id}`,
            "DELETE",
            async () => {
                await apiClient.delete(`/api/stores/${storeId}/sections/${id}`);
            }
        );
    }

    async reorderSections(
        storeId: string,
        updates: Array<{ id: string; sortOrder: number }>
    ): Promise<void> {
        return this.executeMutation(
            "reorderSections",
            `/api/stores/${storeId}/sections/reorder`,
            "POST",
            async () => {
                await apiClient.post(`/api/stores/${storeId}/sections/reorder`, { updates });
            },
            { updates }
        );
    }

    // ========== StoreItem Operations ==========
    async insertItem(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        return this.executeMutation(
            "insertItem",
            `/api/stores/${storeId}/items`,
            "POST",
            async () => {
                const response = await apiClient.post<{ item: StoreItem }>(
                    `/api/stores/${storeId}/items`,
                    { name, aisleId, sectionId }
                );
                return response.item;
            },
            { name, aisleId, sectionId }
        );
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
        return this.executeMutation(
            "updateItem",
            `/api/stores/${storeId}/items/${id}`,
            "PUT",
            async () => {
                const response = await apiClient.put<{ item: StoreItem }>(
                    `/api/stores/${storeId}/items/${id}`,
                    { name, aisleId, sectionId }
                );
                return response.item;
            },
            { name, aisleId, sectionId }
        );
    }

    async toggleItemFavorite(storeId: string, id: string): Promise<StoreItem> {
        return this.executeMutation(
            "toggleItemFavoriteForStore",
            `/api/stores/${storeId}/items/${id}/favorite`,
            "POST",
            async () => {
                const response = await apiClient.post<{ item: StoreItem }>(
                    `/api/stores/${storeId}/items/${id}/favorite`,
                    {}
                );
                return response.item;
            },
            {}
        );
    }

    async deleteItem(storeId: string, id: string): Promise<void> {
        return this.executeMutation(
            "deleteItemForStore",
            `/api/stores/${storeId}/items/${id}`,
            "DELETE",
            async () => {
                await apiClient.delete(`/api/stores/${storeId}/items/${id}`);
            }
        );
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
            // Apply section-aisle normalization: prefer section over aisle
            const normalizedSectionId = sectionId ?? null;
            const normalizedAisleId = sectionId ? null : (aisleId ?? null);

            // Update the item if location information differs
            const needsUpdate =
                normalizedSectionId !== (exactMatch.sectionId ?? null) ||
                normalizedAisleId !== (exactMatch.aisleId ?? null);

            if (needsUpdate) {
                return this.updateItem(
                    storeId,
                    exactMatch.id,
                    exactMatch.name,
                    normalizedAisleId,
                    normalizedSectionId
                );
            }

            return exactMatch;
        }

        return this.insertItem(storeId, name, aisleId, sectionId);
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
        return this.executeMutation(
            "upsertShoppingListItem",
            `/api/stores/${params.storeId}/shopping-list`,
            "POST",
            async () => {
                const response = await apiClient.post<{ item: ShoppingListItem }>(
                    `/api/stores/${params.storeId}/shopping-list`,
                    params
                );
                return response.item;
            },
            params
        );
    }

    async toggleShoppingListItemChecked(
        storeId: string,
        id: string,
        isChecked: boolean
    ): Promise<CheckConflictResult> {
        return this.executeMutation(
            "toggleShoppingListItemChecked",
            `/api/stores/${storeId}/shopping-list/${id}/toggle`,
            "POST",
            async () => {
                const response = await apiClient.post<CheckConflictResult>(
                    `/api/stores/${storeId}/shopping-list/${id}/toggle`,
                    {
                        isChecked,
                    }
                );
                return {
                    conflict: response.conflict,
                    conflictUser: response.conflictUser,
                    itemId: response.itemId,
                    itemName: response.itemName,
                };
            },
            { isChecked }
        );
    }

    /**
     * Delete shopping list item AND the associated store item
     */
    async deleteShoppingListItem(storeId: string, id: string): Promise<void> {
        return this.executeMutation(
            "deleteShoppingListItem",
            `/api/stores/${storeId}/shopping-list/${id}/delete-with-item`,
            "DELETE",
            async () => {
                await apiClient.delete(
                    `/api/stores/${storeId}/shopping-list/${id}/delete-with-item`
                );
            }
        );
    }

    /**
     * Remove shopping list item only (keeps the store item)
     */
    async removeShoppingListItem(storeId: string, id: string): Promise<void> {
        return this.executeMutation(
            "removeShoppingListItem",
            `/api/stores/${storeId}/shopping-list/${id}`,
            "DELETE",
            async () => {
                await apiClient.delete(`/api/stores/${storeId}/shopping-list/${id}`);
            }
        );
    }

    async clearCheckedShoppingListItems(storeId: string): Promise<number> {
        return this.executeMutation(
            "clearCheckedShoppingListItems",
            `/api/stores/${storeId}/shopping-list/clear-checked`,
            "POST",
            async () => {
                const response = await apiClient.post<{ success: boolean; count: number }>(
                    `/api/stores/${storeId}/shopping-list/clear-checked`,
                    {}
                );
                return response.count;
            },
            {}
        );
    }
}
