import { AppSetting } from "../models/AppSetting";
import {
    ShoppingListItem,
    ShoppingListItemOptionalId,
    ShoppingListItemWithDetails,
    Store,
    StoreItemWithDetails,
} from "../models/Store";
import { BaseDatabase } from "./base";
import {
    DEFAULT_TABLES_TO_PERSIST,
    StoreAisle,
    StoreItem,
    StoreSection,
} from "./types";

/**
 * Remote database implementation stub for future API integration
 * All methods throw "not implemented" errors
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export class RemoteDatabase extends BaseDatabase {
    protected async initializeStorage(): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async close(): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async reset(
        _tablesToPersist: string[] = DEFAULT_TABLES_TO_PERSIST
    ): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    protected async hasStores(): Promise<boolean> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    // ========== Store Operations ==========
    async insertStore(_name: string): Promise<Store> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async loadAllQuantityUnits(): Promise<
        import("../models/Store").QuantityUnit[]
    > {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async loadAllStores(): Promise<Store[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getStoreById(_id: string): Promise<Store | null> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async updateStore(_id: string, _name: string): Promise<Store> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async deleteStore(_id: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    // ========== App Settings Operations ==========
    async getAppSetting(_key: string): Promise<AppSetting | null> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async setAppSetting(_key: string, _value: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    // ========== StoreAisle Operations ==========
    async insertAisle(_storeId: string, _name: string): Promise<StoreAisle> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getAislesByStore(_storeId: string): Promise<StoreAisle[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getAisleById(_id: string): Promise<StoreAisle | null> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async updateAisle(_id: string, _name: string): Promise<StoreAisle> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async deleteAisle(_id: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async reorderAisles(
        _updates: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    // ========== StoreSection Operations ==========
    async insertSection(
        _storeId: string,
        _name: string,
        _aisleId: string
    ): Promise<StoreSection> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getSectionsByStore(_storeId: string): Promise<StoreSection[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getSectionById(_id: string): Promise<StoreSection | null> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async updateSection(
        _id: string,
        _name: string,
        _aisleId: string
    ): Promise<StoreSection> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async deleteSection(_id: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async reorderSections(
        _updates: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    // ========== StoreItem Operations ==========
    async insertItem(
        _storeId: string,
        _name: string,
        _aisleId?: string | null,
        _sectionId?: string | null
    ): Promise<StoreItem> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getItemsByStore(_storeId: string): Promise<StoreItem[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getItemsByStoreWithDetails(
        _storeId: string
    ): Promise<StoreItemWithDetails[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getItemById(_id: string): Promise<StoreItem | null> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async updateItem(
        _id: string,
        _name: string,
        _aisleId?: string | null,
        _sectionId?: string | null
    ): Promise<StoreItem> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    toggleItemFavorite(id: string): Promise<StoreItem> {
        throw new Error("RemoteDatabase not yet implemented.");
    }

    async deleteItem(_id: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async getOrCreateStoreItemByName(
        _storeId: string,
        _name: string,
        _aisleId?: string | null,
        _sectionId?: string | null
    ): Promise<StoreItem> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async searchStoreItems(
        _storeId: string,
        _searchTerm: string,
        _limit?: number
    ): Promise<StoreItem[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    // ========== ShoppingList Operations ==========
    async getShoppingListItems(
        _storeId: string
    ): Promise<ShoppingListItemWithDetails[]> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async upsertShoppingListItem(
        params: ShoppingListItemOptionalId
    ): Promise<ShoppingListItem> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async toggleShoppingListItemChecked(
        _id: string,
        _isChecked: boolean
    ): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async deleteShoppingListItem(_id: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }

    async removeShoppingListItem(_id: string): Promise<void> {
        throw new Error("Remote database not implemented");
    }

    async clearCheckedShoppingListItems(_storeId: string): Promise<void> {
        throw new Error("RemoteDatabase not yet implemented");
    }
}
