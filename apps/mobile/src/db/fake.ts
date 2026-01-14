import { AppSetting } from "../models/AppSetting";
import {
    getInitializedStore,
    QUANTITY_UNITS,
    QuantityUnit,
    ShoppingListItem,
    ShoppingListItemOptionalId,
    ShoppingListItemWithDetails,
    Store,
    StoreAisle,
    StoreItem,
    StoreItemWithDetails,
    StoreSection,
} from "../models/Store";
import { normalizeItemName } from "../utils/stringUtils";
import { BaseDatabase } from "./base";
import { DEFAULT_TABLES_TO_PERSIST } from "./types";

/**
 * In-memory fake database implementation for browser/development
 */
export class FakeDatabase extends BaseDatabase {
    private stores: Map<string, Store> = new Map();
    private aisles: Map<string, StoreAisle> = new Map();
    private sections: Map<string, StoreSection> = new Map();
    private items: Map<string, StoreItem> = new Map();
    private shoppingListItems: Map<string, ShoppingListItem> = new Map();
    private appSettings: Map<string, AppSetting> = new Map();
    private quantityUnits: Map<string, QuantityUnit> = new Map();
    private initialized = false;

    protected async initializeStorage(): Promise<void> {
        if (this.initialized) {
            return;
        }

        // Simulate async init delay (10ms, not 10s)
        //await new Promise((resolve) => setTimeout(resolve, 10000));

        // Initialize quantity units
        this.initializeQuantityUnits();

        this.initialized = true;
        this.notifyChange();
    }

    private initializeQuantityUnits(): void {
        QUANTITY_UNITS.forEach((unit) => this.quantityUnits.set(unit.id, unit));
    }

    async close(): Promise<void> {
        // Nothing to close for in-memory database
        this.initialized = false;
        this.notifyChange();
    }

    protected async hasStores(): Promise<boolean> {
        return this.stores.size > 0;
    }

    async reset(
        tablesToPersist: string[] = DEFAULT_TABLES_TO_PERSIST
    ): Promise<void> {
        // Clear all data except persisted tables
        if (!tablesToPersist.includes("store")) {
            this.stores.clear();
            this.aisles.clear();
            this.sections.clear();
            this.items.clear();
        }
        if (!tablesToPersist.includes("app_setting")) {
            this.appSettings.clear();
        }

        await this.ensureInitialData();
        this.notifyChange();
    }

    // ========== Store Operations ==========
    async insertStore(name: string): Promise<Store> {
        const newStore = getInitializedStore(name);
        this.stores.set(newStore.id, newStore);
        this.notifyChange();
        return newStore;
    }

    async loadAllQuantityUnits(): Promise<QuantityUnit[]> {
        return Array.from(this.quantityUnits.values()).sort(
            (a, b) => a.sort_order - b.sort_order
        );
    }

    async loadAllStores(): Promise<Store[]> {
        return Array.from(this.stores.values()).sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
    }

    async getStoreById(id: string): Promise<Store | null> {
        const store = this.stores.get(id);
        if (!store) {
            return null;
        }
        return store;
    }

    async updateStore(id: string, name: string): Promise<Store> {
        const store = this.stores.get(id);
        if (!store) {
            throw new Error(`Store with id ${id} not found`);
        }

        const updatedStore: Store = {
            ...store,
            name,
            updated_at: new Date().toISOString(),
        };
        this.stores.set(id, updatedStore);
        this.notifyChange();
        return updatedStore;
    }

    async deleteStore(id: string): Promise<void> {
        const store = this.stores.get(id);
        if (!store) {
            return;
        }

        // CASCADE: Delete all related entities
        // Delete shopping list items for this store
        Array.from(this.shoppingListItems.values())
            .filter((item) => item.store_id === id)
            .forEach((item) => this.shoppingListItems.delete(item.id));

        // Delete store items for this store
        Array.from(this.items.values())
            .filter((item) => item.store_id === id)
            .forEach((item) => this.items.delete(item.id));

        // Delete sections for this store
        Array.from(this.sections.values())
            .filter((section) => section.store_id === id)
            .forEach((section) => this.sections.delete(section.id));

        // Delete aisles for this store
        Array.from(this.aisles.values())
            .filter((aisle) => aisle.store_id === id)
            .forEach((aisle) => this.aisles.delete(aisle.id));

        // Delete the store itself
        this.stores.delete(id);
        this.notifyChange();
    }

    // ========== App Settings Operations ==========
    async getAppSetting(key: string): Promise<AppSetting | null> {
        return this.appSettings.get(key) || null;
    }

    async setAppSetting(key: string, value: string): Promise<void> {
        const setting: AppSetting = {
            key,
            value,
            updated_at: new Date().toISOString(),
        };
        this.appSettings.set(key, setting);
        this.notifyChange();
    }

    // ========== StoreAisle Operations ==========
    async insertAisle(storeId: string, name: string): Promise<StoreAisle> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const existingAisles = Array.from(this.aisles.values()).filter(
            (a) => a.store_id === storeId
        );
        const sort_order = existingAisles.length;

        const aisle: StoreAisle = {
            id,
            store_id: storeId,
            name,
            sort_order,
            created_at: now,
            updated_at: now,
        };
        this.aisles.set(id, aisle);
        this.notifyChange();
        return aisle;
    }

    async getAislesByStore(storeId: string): Promise<StoreAisle[]> {
        return Array.from(this.aisles.values())
            .filter((aisle) => aisle.store_id === storeId)
            .sort((a, b) => a.sort_order - b.sort_order);
    }

    async getAisleById(id: string): Promise<StoreAisle | null> {
        const aisle = this.aisles.get(id);
        return aisle ? aisle : null;
    }

    async updateAisle(id: string, name: string): Promise<StoreAisle> {
        const aisle = this.aisles.get(id);
        if (!aisle) {
            throw new Error(`Aisle with id ${id} not found`);
        }

        const updated: StoreAisle = {
            ...aisle,
            name,
            updated_at: new Date().toISOString(),
        };
        this.aisles.set(id, updated);
        this.notifyChange();
        return updated;
    }

    async deleteAisle(id: string): Promise<void> {
        const aisle = this.aisles.get(id);
        if (aisle) {
            this.aisles.delete(id);
            this.notifyChange();
        }
    }

    async reorderAisles(
        updates: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        const now = new Date().toISOString();
        for (const { id, sort_order } of updates) {
            const aisle = this.aisles.get(id);
            if (aisle) {
                this.aisles.set(id, {
                    ...aisle,
                    sort_order,
                    updated_at: now,
                });
            }
        }
        this.notifyChange();
    }

    // ========== StoreSection Operations ==========
    async insertSection(
        storeId: string,
        name: string,
        aisleId: string
    ): Promise<StoreSection> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const existingSections = Array.from(this.sections.values()).filter(
            (s) => s.aisle_id === aisleId
        );
        const sort_order = existingSections.length;

        const section: StoreSection = {
            id,
            store_id: storeId,
            aisle_id: aisleId,
            name,
            sort_order,
            created_at: now,
            updated_at: now,
        };
        this.sections.set(id, section);
        this.notifyChange();
        return section;
    }

    async getSectionsByStore(storeId: string): Promise<StoreSection[]> {
        return Array.from(this.sections.values())
            .filter((section) => section.store_id === storeId)
            .sort((a, b) => a.sort_order - b.sort_order);
    }

    async getSectionById(id: string): Promise<StoreSection | null> {
        const section = this.sections.get(id);
        return section ? section : null;
    }

    async updateSection(
        id: string,
        name: string,
        aisleId: string
    ): Promise<StoreSection> {
        const section = this.sections.get(id);
        if (!section) {
            throw new Error(`Section with id ${id} not found`);
        }

        const updated: StoreSection = {
            ...section,
            name,
            aisle_id: aisleId,
            updated_at: new Date().toISOString(),
        };
        this.sections.set(id, updated);
        this.notifyChange();
        return updated;
    }

    async deleteSection(id: string): Promise<void> {
        const section = this.sections.get(id);
        if (section) {
            this.sections.delete(id);
            this.notifyChange();
        }
    }

    async reorderSections(
        updates: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        const now = new Date().toISOString();
        for (const { id, sort_order } of updates) {
            const section = this.sections.get(id);
            if (section) {
                this.sections.set(id, {
                    ...section,
                    sort_order,
                    updated_at: now,
                });
            }
        }
        this.notifyChange();
    }

    // ========== StoreItem Operations ==========
    async insertItem(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const name_norm = normalizeItemName(name);

        // Normalize: store only section when present (null aisle), else store aisle
        const normalizedAisleId = sectionId ? null : aisleId ?? null;
        const normalizedSectionId = sectionId ?? null;

        const item: StoreItem = {
            id,
            store_id: storeId,
            name,
            name_norm,
            aisle_id: normalizedAisleId,
            section_id: normalizedSectionId,
            usage_count: 0,
            last_used_at: null,
            is_hidden: 0,
            is_favorite: 0,
            created_at: now,
            updated_at: now,
        };
        this.items.set(id, item);
        this.notifyChange();
        return item;
    }

    async getItemsByStore(storeId: string): Promise<StoreItem[]> {
        return Array.from(this.items.values())
            .filter((item) => item.store_id === storeId && item.is_hidden === 0)
            .sort((a, b) => a.name_norm.localeCompare(b.name_norm));
    }

    async getItemsByStoreWithDetails(
        storeId: string
    ): Promise<StoreItemWithDetails[]> {
        const items = Array.from(this.items.values()).filter(
            (item) => item.store_id === storeId && item.is_hidden === 0
        );

        return items
            .map((item) => {
                const section = item.section_id
                    ? this.sections.get(item.section_id)
                    : null;
                const aisleId = section?.aisle_id || item.aisle_id;
                const aisle = aisleId ? this.aisles.get(aisleId) : null;

                return {
                    ...item,
                    aisle_id: aisleId || null,
                    aisle_name: aisle?.name || null,
                    aisle_sort_order: aisle?.sort_order || null,
                    section_name: section?.name || null,
                    section_sort_order: section?.sort_order || null,
                };
            })
            .sort((a, b) => {
                const aSortOrder = a.aisle_sort_order ?? 999999;
                const bSortOrder = b.aisle_sort_order ?? 999999;
                if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;

                const aSectionSort = a.section_sort_order ?? 999999;
                const bSectionSort = b.section_sort_order ?? 999999;
                if (aSectionSort !== bSectionSort)
                    return aSectionSort - bSectionSort;

                return a.name_norm.localeCompare(b.name_norm);
            });
    }

    async getItemById(id: string): Promise<StoreItem | null> {
        const item = this.items.get(id);
        return item ? item : null;
    }

    async updateItem(
        id: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const item = this.items.get(id);
        if (!item) {
            throw new Error(`Item with id ${id} not found`);
        }

        const name_norm = normalizeItemName(name);

        // Normalize: store only section when present (null aisle), else store aisle
        const normalizedAisleId = sectionId ? null : aisleId ?? null;
        const normalizedSectionId = sectionId ?? null;

        const updated: StoreItem = {
            ...item,
            name,
            name_norm,
            aisle_id: normalizedAisleId,
            section_id: normalizedSectionId,
            updated_at: new Date().toISOString(),
        };
        this.items.set(id, updated);
        this.notifyChange();
        return updated;
    }

    async toggleItemFavorite(id: string): Promise<StoreItem> {
        const item = this.items.get(id);
        if (!item) {
            throw new Error(`Item with id ${id} not found`);
        }

        const updated: StoreItem = {
            ...item,
            is_favorite: item.is_favorite === 0 ? 1 : 0,
            updated_at: new Date().toISOString(),
        };
        this.items.set(id, updated);
        this.notifyChange();
        return updated;
    }

    async deleteItem(id: string): Promise<void> {
        const item = this.items.get(id);
        if (item) {
            this.items.delete(id);
            this.notifyChange();
        }
    }

    async searchStoreItems(
        storeId: string,
        searchTerm: string,
        limit: number = 10
    ): Promise<StoreItem[]> {
        const searchNorm = normalizeItemName(searchTerm);
        return Array.from(this.items.values())
            .filter(
                (item) =>
                    item.store_id === storeId &&
                    item.is_hidden === 0 &&
                    item.name_norm.includes(searchNorm)
            )
            .sort((a, b) => {
                // Prioritize items that start with search term
                const aStarts = a.name_norm.startsWith(searchNorm);
                const bStarts = b.name_norm.startsWith(searchNorm);
                if (aStarts !== bStarts) {
                    return bStarts ? 1 : -1;
                }

                // Then sort by usage_count desc, last_used_at desc, then name
                if (b.usage_count !== a.usage_count) {
                    return b.usage_count - a.usage_count;
                }
                if (a.last_used_at && b.last_used_at) {
                    return (
                        new Date(b.last_used_at).getTime() -
                        new Date(a.last_used_at).getTime()
                    );
                }
                return a.name_norm.localeCompare(b.name_norm);
            })
            .slice(0, limit);
    }

    // ========== ShoppingList Operations ==========
    async getShoppingListItems(
        storeId: string
    ): Promise<ShoppingListItemWithDetails[]> {
        const items = Array.from(this.shoppingListItems.values())
            .filter((item) => item.store_id === storeId)
            .map((item) => {
                // For ideas, store_item_id is null
                const storeItem = item.store_item_id
                    ? this.items.get(item.store_item_id)
                    : null;

                // Join with quantity_unit
                const unit = item.unit_id
                    ? this.quantityUnits.get(item.unit_id)
                    : null;

                // Join with section and aisle from store_item (if exists)
                const section =
                    storeItem && storeItem.section_id
                        ? this.sections.get(storeItem.section_id)
                        : null;
                // Prefer section's aisle_id over item's direct aisle_id
                const calculatedAisleId =
                    section?.aisle_id ?? storeItem?.aisle_id ?? null;
                const aisle = calculatedAisleId
                    ? this.aisles.get(calculatedAisleId)
                    : null;

                return {
                    ...item,
                    item_name: storeItem?.name ?? "",
                    unit_abbreviation: unit?.abbreviation ?? null,
                    section_id: section?.id ?? null,
                    aisle_id: calculatedAisleId,
                    section_name: section?.name ?? null,
                    section_sort_order: section?.sort_order ?? null,
                    aisle_name: aisle?.name ?? null,
                    aisle_sort_order: aisle?.sort_order ?? null,
                } as ShoppingListItemWithDetails;
            })
            .sort((a, b) => {
                // Sort by: is_checked, is_idea (DESC), aisle, section, item name/notes
                if (a.is_checked !== b.is_checked) {
                    return a.is_checked - b.is_checked;
                }
                // Ideas first (1 before 0)
                const aIsIdea = a.is_idea ?? 0;
                const bIsIdea = b.is_idea ?? 0;
                if (aIsIdea !== bIsIdea) {
                    return bIsIdea - aIsIdea;
                }
                const aAisleOrder = a.aisle_sort_order ?? 999999;
                const bAisleOrder = b.aisle_sort_order ?? 999999;
                if (aAisleOrder !== bAisleOrder) {
                    return aAisleOrder - bAisleOrder;
                }
                const aSectionOrder = a.section_sort_order ?? 999999;
                const bSectionOrder = b.section_sort_order ?? 999999;
                if (aSectionOrder !== bSectionOrder) {
                    return aSectionOrder - bSectionOrder;
                }
                // Use notes for ideas, item_name for regular items
                const aName = a.item_name || a.notes || "";
                const bName = b.item_name || b.notes || "";
                return aName.localeCompare(bName);
            });

        return items;
    }

    async getOrCreateStoreItemByName(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const now = new Date().toISOString();
        const name_norm = normalizeItemName(name);

        // Try to find existing item
        const existingItem = Array.from(this.items.values()).find(
            (item) => item.store_id === storeId && item.name_norm === name_norm
        );

        if (existingItem) {
            // Update usage count, last_used_at, and location if provided
            const normalizedAisleId = sectionId
                ? null
                : aisleId ?? existingItem.aisle_id;
            const normalizedSectionId = sectionId ?? existingItem.section_id;

            const updatedItem: StoreItem = {
                ...existingItem,
                usage_count: existingItem.usage_count + 1,
                last_used_at: now,
                aisle_id: normalizedAisleId,
                section_id: normalizedSectionId,
                updated_at: now,
            };
            this.items.set(existingItem.id, updatedItem);
            this.notifyChange();
            return updatedItem;
        } else {
            // Create new item
            return await this.insertItem(storeId, name, aisleId, sectionId);
        }
    }

    async upsertShoppingListItem(
        params: ShoppingListItemOptionalId
    ): Promise<ShoppingListItem> {
        const now = new Date().toISOString();

        if (params.id) {
            // Update existing shopping list item
            const existing = this.shoppingListItems.get(params.id);
            if (!existing) {
                throw new Error(`Shopping list item ${params.id} not found`);
            }

            const updated: ShoppingListItem = {
                ...existing,
                store_item_id: params.store_item_id || null,
                qty: params.qty ?? null,
                unit_id: params.unit_id || null,
                notes: params.notes,
                is_sample: params.is_sample ?? null,
                is_idea: params.is_idea ? 1 : 0,
                snoozed_until: params.snoozed_until || null,
                updated_at: now,
            };
            this.shoppingListItems.set(params.id, updated);
            this.notifyChange();
            return updated;
        } else {
            // Create new shopping list item
            const id = crypto.randomUUID();

            const newItem: ShoppingListItem = {
                id,
                store_id: params.store_id,
                store_item_id: params.store_item_id || null,
                qty: params.qty ?? null,
                unit_id: params.unit_id || null,
                notes: params.notes,
                is_checked: 0,
                checked_at: null,
                is_sample: params.is_sample ?? null,
                is_idea: params.is_idea ? 1 : 0,
                snoozed_until: params.snoozed_until || null,
                created_at: now,
                updated_at: now,
            };
            this.shoppingListItems.set(id, newItem);
            this.notifyChange();
            return newItem;
        }
    }

    async toggleShoppingListItemChecked(
        id: string,
        isChecked: boolean
    ): Promise<void> {
        const item = this.shoppingListItems.get(id);
        if (item) {
            const now = new Date().toISOString();
            this.shoppingListItems.set(id, {
                ...item,
                is_checked: isChecked ? 1 : 0,
                checked_at: isChecked ? now : null,
                updated_at: now,
            });
            this.notifyChange();
        }
    }

    async deleteShoppingListItem(id: string): Promise<void> {
        const item = this.shoppingListItems.get(id);
        if (item) {
            // Delete the shopping list item
            this.shoppingListItems.delete(id);

            // If there was an associated store item, delete it too (cascade)
            if (item.store_item_id) {
                this.items.delete(item.store_item_id);
            }

            this.notifyChange();
        }
    }

    async removeShoppingListItem(id: string): Promise<void> {
        // Only remove from shopping list, leave store items intact
        this.shoppingListItems.delete(id);
        this.notifyChange();
    }

    async clearCheckedShoppingListItems(storeId: string): Promise<void> {
        const items = Array.from(this.shoppingListItems.values()).filter(
            (item) => item.store_id === storeId && item.is_checked === 1
        );

        for (const item of items) {
            this.shoppingListItems.delete(item.id);
        }

        this.notifyChange();
    }
}
