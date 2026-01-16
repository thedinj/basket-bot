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
import { QUANTITY_UNITS } from "@basket-bot/core";
import { normalizeItemName } from "../utils/stringUtils";
import { BaseDatabase } from "./base";
import { DEFAULT_TABLES_TO_PERSIST } from "./types";

// Mock user ID for FakeDatabase audit fields
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Helper to create a Store with audit fields populated
 */
function getInitializedStore(
    name: string,
    householdId = "00000000-0000-0000-0000-000000000001"
): Store {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        householdId,
        name,
        createdById: MOCK_USER_ID,
        updatedById: MOCK_USER_ID,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Helper to create a StoreAisle with audit fields populated
 */
function getInitializedStoreAisle(storeId: string, name: string, sortOrder: number): StoreAisle {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        storeId,
        name,
        sortOrder,
        createdById: MOCK_USER_ID,
        updatedById: MOCK_USER_ID,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Helper to create a StoreSection with audit fields populated
 */
function getInitializedStoreSection(
    storeId: string,
    aisleId: string,
    name: string,
    sortOrder: number
): StoreSection {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        storeId,
        aisleId,
        name,
        sortOrder,
        createdById: MOCK_USER_ID,
        updatedById: MOCK_USER_ID,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Helper to create a StoreItem with audit fields populated
 */
function getInitializedStoreItem(
    storeId: string,
    name: string,
    aisleId: string | null,
    sectionId: string | null
): StoreItem {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        storeId,
        name,
        nameNorm: normalizeItemName(name),
        aisleId,
        sectionId,
        usageCount: 0,
        lastUsedAt: null,
        isHidden: false,
        isFavorite: false,
        createdById: MOCK_USER_ID,
        updatedById: MOCK_USER_ID,
        createdAt: now,
        updatedAt: now,
    };
}

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
        QUANTITY_UNITS.forEach((unit: QuantityUnit) => this.quantityUnits.set(unit.id, unit));
    }

    async close(): Promise<void> {
        // Nothing to close for in-memory database
        this.initialized = false;
        this.notifyChange();
    }

    protected async hasStores(): Promise<boolean> {
        return this.stores.size > 0;
    }

    async reset(tablesToPersist: string[] = DEFAULT_TABLES_TO_PERSIST): Promise<void> {
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
        return Array.from(this.quantityUnits.values()).sort((a, b) => a.sortOrder - b.sortOrder);
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
            updatedAt: new Date().toISOString(),
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
            .filter((item) => item.storeId === id)
            .forEach((item) => this.shoppingListItems.delete(item.id));

        // Delete store items for this store
        Array.from(this.items.values())
            .filter((item) => item.storeId === id)
            .forEach((item) => this.items.delete(item.id));

        // Delete sections for this store
        Array.from(this.sections.values())
            .filter((section) => section.storeId === id)
            .forEach((section) => this.sections.delete(section.id));

        // Delete aisles for this store
        Array.from(this.aisles.values())
            .filter((aisle) => aisle.storeId === id)
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
            updatedAt: new Date().toISOString(),
        };
        this.appSettings.set(key, setting);
        this.notifyChange();
    }

    // ========== StoreAisle Operations ==========
    async insertAisle(storeId: string, name: string): Promise<StoreAisle> {
        const existingAisles = Array.from(this.aisles.values()).filter(
            (a) => a.storeId === storeId
        );
        const sortOrder = existingAisles.length;

        const aisle = getInitializedStoreAisle(storeId, name, sortOrder);
        this.aisles.set(aisle.id, aisle);
        this.notifyChange();
        return aisle;
    }

    async getAislesByStore(storeId: string): Promise<StoreAisle[]> {
        return Array.from(this.aisles.values())
            .filter((aisle) => aisle.storeId === storeId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
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
            updatedAt: new Date().toISOString(),
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

    async reorderAisles(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
        const now = new Date().toISOString();
        for (const { id, sortOrder } of updates) {
            const aisle = this.aisles.get(id);
            if (aisle) {
                this.aisles.set(id, {
                    ...aisle,
                    sortOrder,
                    updatedAt: now,
                });
            }
        }
        this.notifyChange();
    }

    // ========== StoreSection Operations ==========
    async insertSection(storeId: string, name: string, aisleId: string): Promise<StoreSection> {
        const existingSections = Array.from(this.sections.values()).filter(
            (s) => s.aisleId === aisleId
        );
        const sortOrder = existingSections.length;

        const section = getInitializedStoreSection(storeId, aisleId, name, sortOrder);
        this.sections.set(section.id, section);
        this.notifyChange();
        return section;
    }

    async getSectionsByStore(storeId: string): Promise<StoreSection[]> {
        return Array.from(this.sections.values())
            .filter((section) => section.storeId === storeId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }

    async getSectionById(id: string): Promise<StoreSection | null> {
        const section = this.sections.get(id);
        return section ? section : null;
    }

    async updateSection(id: string, name: string, aisleId: string): Promise<StoreSection> {
        const section = this.sections.get(id);
        if (!section) {
            throw new Error(`Section with id ${id} not found`);
        }

        const updated: StoreSection = {
            ...section,
            name,
            aisleId: aisleId,
            updatedAt: new Date().toISOString(),
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

    async reorderSections(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
        const now = new Date().toISOString();
        for (const { id, sortOrder } of updates) {
            const section = this.sections.get(id);
            if (section) {
                this.sections.set(id, {
                    ...section,
                    sortOrder,
                    updatedAt: now,
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
        // Normalize: store only section when present (null aisle), else store aisle
        const normalizedAisleId = sectionId ? null : (aisleId ?? null);
        const normalizedSectionId = sectionId ?? null;

        const item = getInitializedStoreItem(storeId, name, normalizedAisleId, normalizedSectionId);
        this.items.set(item.id, item);
        this.notifyChange();
        return item;
    }

    async getItemsByStore(storeId: string): Promise<StoreItem[]> {
        return Array.from(this.items.values())
            .filter((item) => item.storeId === storeId && !item.isHidden)
            .sort((a, b) => a.nameNorm.localeCompare(b.nameNorm));
    }

    async getItemsByStoreWithDetails(storeId: string): Promise<StoreItemWithDetails[]> {
        const items = Array.from(this.items.values()).filter(
            (item) => item.storeId === storeId && !item.isHidden
        );

        return items
            .map((item) => {
                const section = item.sectionId ? this.sections.get(item.sectionId) : null;
                const aisleId = section?.aisleId || item.aisleId;
                const aisle = aisleId ? this.aisles.get(aisleId) : null;

                return {
                    ...item,
                    aisleId: aisleId || null,
                    aisleName: aisle?.name || null,
                    aisleSortOrder: aisle?.sortOrder || null,
                    sectionName: section?.name || null,
                    sectionSortOrder: section?.sortOrder || null,
                };
            })
            .sort((a, b) => {
                const aSortOrder = a.aisleSortOrder ?? 999999;
                const bSortOrder = b.aisleSortOrder ?? 999999;
                if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;

                const aSectionSort = a.sectionSortOrder ?? 999999;
                const bSectionSort = b.sectionSortOrder ?? 999999;
                if (aSectionSort !== bSectionSort) return aSectionSort - bSectionSort;

                return a.nameNorm.localeCompare(b.nameNorm);
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

        const nameNorm = normalizeItemName(name);

        // Normalize: store only section when present (null aisle), else store aisle
        const normalizedAisleId = sectionId ? null : (aisleId ?? null);
        const normalizedSectionId = sectionId ?? null;

        const updated: StoreItem = {
            ...item,
            name,
            nameNorm,
            aisleId: normalizedAisleId,
            sectionId: normalizedSectionId,
            updatedAt: new Date().toISOString(),
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
            isFavorite: !item.isFavorite,
            updatedAt: new Date().toISOString(),
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
                    item.storeId === storeId && !item.isHidden && item.nameNorm.includes(searchNorm)
            )
            .sort((a, b) => {
                // Prioritize items that start with search term
                const aStarts = a.nameNorm.startsWith(searchNorm);
                const bStarts = b.nameNorm.startsWith(searchNorm);
                if (aStarts !== bStarts) {
                    return bStarts ? 1 : -1;
                }

                // Then sort by usageCount desc, lastUsedAt desc, then name
                if (b.usageCount !== a.usageCount) {
                    return b.usageCount - a.usageCount;
                }
                if (a.lastUsedAt && b.lastUsedAt) {
                    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
                }
                return a.nameNorm.localeCompare(b.nameNorm);
            })
            .slice(0, limit);
    }

    // ========== ShoppingList Operations ==========
    async getShoppingListItems(storeId: string): Promise<ShoppingListItemWithDetails[]> {
        const items = Array.from(this.shoppingListItems.values())
            .filter((item) => item.storeId === storeId)
            .map((item) => {
                // For ideas, storeItemId is null
                const storeItem = item.storeItemId ? this.items.get(item.storeItemId) : null;

                // Join with quantity_unit
                const unit = item.unitId ? this.quantityUnits.get(item.unitId) : null;

                // Join with section and aisle from store_item (if exists)
                const section =
                    storeItem && storeItem.sectionId
                        ? this.sections.get(storeItem.sectionId)
                        : null;
                // Prefer section's aisleId over item's direct aisleId
                const calculatedAisleId = section?.aisleId ?? storeItem?.aisleId ?? null;
                const aisle = calculatedAisleId ? this.aisles.get(calculatedAisleId) : null;

                return {
                    ...item,
                    itemName: storeItem?.name ?? "",
                    unitAbbreviation: unit?.abbreviation ?? null,
                    sectionId: section?.id ?? null,
                    aisleId: calculatedAisleId,
                    sectionName: section?.name ?? null,
                    sectionSortOrder: section?.sortOrder ?? null,
                    aisleName: aisle?.name ?? null,
                    aisleSortOrder: aisle?.sortOrder ?? null,
                } as ShoppingListItemWithDetails;
            })
            .sort((a, b) => {
                // Sort by: isChecked, isIdea (DESC), aisle, section, item name/notes
                if (a.isChecked !== b.isChecked) {
                    return Number(a.isChecked) - Number(b.isChecked);
                }
                // Ideas first (1 before 0)
                const aIsIdea = a.isIdea ?? 0;
                const bIsIdea = b.isIdea ?? 0;
                if (aIsIdea !== bIsIdea) {
                    return Number(bIsIdea) - Number(aIsIdea);
                }
                const aAisleOrder = a.aisleSortOrder ?? 999999;
                const bAisleOrder = b.aisleSortOrder ?? 999999;
                if (aAisleOrder !== bAisleOrder) {
                    return aAisleOrder - bAisleOrder;
                }
                const aSectionOrder = a.sectionSortOrder ?? 999999;
                const bSectionOrder = b.sectionSortOrder ?? 999999;
                if (aSectionOrder !== bSectionOrder) {
                    return aSectionOrder - bSectionOrder;
                }
                // Use notes for ideas, itemName for regular items
                const aName = a.itemName || a.notes || "";
                const bName = b.itemName || b.notes || "";
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
        const nameNorm = normalizeItemName(name);

        // Try to find existing item
        const existingItem = Array.from(this.items.values()).find(
            (item) => item.storeId === storeId && item.nameNorm === nameNorm
        );

        if (existingItem) {
            // Update usage count, lastUsedAt, and location if provided
            const normalizedAisleId = sectionId ? null : (aisleId ?? existingItem.aisleId);
            const normalizedSectionId = sectionId ?? existingItem.sectionId;

            const updatedItem: StoreItem = {
                ...existingItem,
                usageCount: existingItem.usageCount + 1,
                lastUsedAt: now,
                aisleId: normalizedAisleId,
                sectionId: normalizedSectionId,
                updatedAt: now,
            };
            this.items.set(existingItem.id, updatedItem);
            this.notifyChange();
            return updatedItem;
        } else {
            // Create new item
            return await this.insertItem(storeId, name, aisleId, sectionId);
        }
    }

    async upsertShoppingListItem(params: ShoppingListItemInput): Promise<ShoppingListItem> {
        const now = new Date().toISOString();

        if (params.id) {
            // Update existing shopping list item
            const existing = this.shoppingListItems.get(params.id);
            if (!existing) {
                throw new Error(`Shopping list item ${params.id} not found`);
            }

            // Apply defaults for optional fields
            const isChecked = params.isChecked ?? existing.isChecked;
            const isIdea = params.isIdea ?? existing.isIdea;
            const isSample = params.isSample ?? existing.isSample;

            // Compute checkedAt based on state change
            let checkedAt = existing.checkedAt;
            if (isChecked !== existing.isChecked) {
                checkedAt = isChecked ? now : null;
            }

            const updated: ShoppingListItem = {
                ...existing,
                storeItemId: params.storeItemId ?? existing.storeItemId,
                qty: params.qty ?? existing.qty,
                unitId: params.unitId ?? existing.unitId,
                notes: params.notes ?? existing.notes,
                isChecked,
                checkedAt,
                isSample,
                isIdea,
                snoozedUntil: params.snoozedUntil ?? existing.snoozedUntil,
                updatedById: MOCK_USER_ID,
                updatedAt: now,
            };
            this.shoppingListItems.set(params.id, updated);
            this.notifyChange();
            return updated;
        } else {
            // Create new shopping list item
            const id = crypto.randomUUID();

            // Apply defaults for optional fields
            const isChecked = params.isChecked ?? false;
            const isIdea = params.isIdea ?? false;
            const isSample = params.isSample ?? null;

            const newItem: ShoppingListItem = {
                id,
                storeId: params.storeId,
                storeItemId: params.storeItemId ?? null,
                qty: params.qty ?? null,
                unitId: params.unitId ?? null,
                notes: params.notes ?? null,
                isChecked,
                checkedAt: isChecked ? now : null,
                isSample,
                isIdea,
                snoozedUntil: params.snoozedUntil ?? null,
                createdById: MOCK_USER_ID,
                updatedById: MOCK_USER_ID,
                createdAt: now,
                updatedAt: now,
            };
            this.shoppingListItems.set(id, newItem);
            this.notifyChange();
            return newItem;
        }
    }

    async toggleShoppingListItemChecked(id: string, isChecked: boolean): Promise<void> {
        const item = this.shoppingListItems.get(id);
        if (item) {
            const now = new Date().toISOString();
            this.shoppingListItems.set(id, {
                ...item,
                isChecked: isChecked,
                checkedAt: isChecked ? now : null,
                updatedAt: now,
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
            if (item.storeItemId) {
                this.items.delete(item.storeItemId);
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
            (item) => item.storeId === storeId && item.isChecked
        );

        for (const item of items) {
            this.shoppingListItems.delete(item.id);
        }

        this.notifyChange();
    }
}
