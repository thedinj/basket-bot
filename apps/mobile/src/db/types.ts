import type {
    AppSetting,
    QuantityUnit,
    ShoppingListItem,
    ShoppingListItemOptionalId,
    ShoppingListItemWithDetails,
    Store,
    StoreAisle,
    StoreItem,
    StoreItemWithDetails,
    StoreSection,
} from "@basket-bot/core";

// Re-export types for convenience
export type { ShoppingListItem, StoreAisle, StoreItem, StoreItemWithDetails, StoreSection };

/**
 * Default tables to preserve during database reset
 */
export const DEFAULT_TABLES_TO_PERSIST = ["app_setting"];

export type DatabaseChangeListener = () => void;

/**
 * Core database operations for lifecycle management
 */
export interface CoreDatabase {
    /**
     * Initialize the database connection and schema
     */
    initialize(): Promise<void>;

    /**
     * Close the database connection
     */
    close(): Promise<void>;

    /**
     * Reset the database by clearing data from specified tables
     * @param tablesToPersist - Array of table names to preserve during reset
     */
    reset(tablesToPersist?: string[]): Promise<void>;
}

export interface DatabaseEvents {
    /**
     * Subscribe to database change events. Returns an unsubscribe function.
     */
    onChange(listener: DatabaseChangeListener): () => void;
}

/**
 * Picks specified keys from T and makes them all optional
 */
export type PartialPick<T, K extends keyof T> = Partial<Pick<T, K>>;

/**
 * Entity-specific database operations
 */
export interface EntityDatabase {
    // ========== Store Operations ==========
    /**
     * Insert a new store
     */
    insertStore(name: string): Promise<Store>;

    /**
     * Load all non-deleted stores
     */
    loadAllStores(): Promise<Store[]>;

    /**
     * Get a single store by ID
     */
    getStoreById(id: string): Promise<Store | null>;

    /**
     * Update a store's name
     */
    updateStore(id: string, name: string): Promise<Store>;

    /**
     * Soft delete a store
     */
    deleteStore(id: string): Promise<void>;

    // ========== App Settings Operations ==========
    /**
     * Get an app setting by key
     */
    getAppSetting(key: string): Promise<AppSetting | null>;

    /**
     * Set an app setting
     */
    setAppSetting(key: string, value: string): Promise<void>;

    // ========== Quantity Unit Operations ==========
    /**
     * Load all quantity units for dropdown display
     */
    loadAllQuantityUnits(): Promise<QuantityUnit[]>;

    // ========== StoreAisle Operations ==========
    /**
     * Insert a new aisle
     */
    insertAisle(storeId: string, name: string): Promise<StoreAisle>;

    /**
     * Get all non-deleted aisles for a store (ordered by sortOrder)
     */
    getAislesByStore(storeId: string): Promise<StoreAisle[]>;

    /**
     * Get a single aisle by ID
     */
    getAisleById(id: string): Promise<StoreAisle | null>;

    /**
     * Update an aisle's name
     */
    updateAisle(id: string, name: string): Promise<StoreAisle>;

    /**
     * Soft delete an aisle
     */
    deleteAisle(id: string): Promise<void>;

    /**
     * Update sort order for multiple aisles
     */
    reorderAisles(updates: Array<{ id: string; sortOrder: number }>): Promise<void>;

    // ========== StoreSection Operations ==========
    /**
     * Insert a new section
     */
    insertSection(storeId: string, name: string, aisleId: string): Promise<StoreSection>;

    /**
     * Get all non-deleted sections for a store (ordered by sortOrder)
     */
    getSectionsByStore(storeId: string): Promise<StoreSection[]>;

    /**
     * Get a single section by ID
     */
    getSectionById(id: string): Promise<StoreSection | null>;

    /**
     * Update a section's name and/or aisle assignment
     */
    updateSection(id: string, name: string, aisleId: string): Promise<StoreSection>;

    /**
     * Soft delete a section
     */
    deleteSection(id: string): Promise<void>;

    /**
     * Update sort order for multiple sections
     */
    reorderSections(updates: Array<{ id: string; sortOrder: number }>): Promise<void>;

    // ========== StoreItem Operations ==========
    /**
     * Insert a new item
     */
    insertItem(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem>;

    /**
     * Get all non-deleted, non-hidden items for a store
     */
    getItemsByStore(storeId: string): Promise<StoreItem[]>;

    /**
     * Get all non-deleted, non-hidden items for a store with location details
     */
    getItemsByStoreWithDetails(storeId: string): Promise<StoreItemWithDetails[]>;

    /**
     * Get a single item by ID
     */
    getItemById(id: string): Promise<StoreItem | null>;

    /**
     * Update an item
     */
    updateItem(
        id: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem>;

    /**
     * Toggle the favorite status of an item
     */
    toggleItemFavorite(id: string): Promise<StoreItem>;

    /**
     * Soft delete an item
     */
    deleteItem(id: string): Promise<void>;

    /**
     * Search for items by name prefix (for autocomplete)
     */
    searchStoreItems(storeId: string, searchTerm: string, limit?: number): Promise<StoreItem[]>;

    /**
     * Get or create a store item by name
     * Updates usage count and location if item exists
     * Creates new item if it doesn't exist
     */
    getOrCreateStoreItemByName(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem>;

    // ========== ShoppingList Operations ==========
    /**
     * Get all shopping list items for a store, joined with aisle/section info
     * Ordered by: isChecked, aisle sortOrder, section sortOrder, item name
     */
    getShoppingListItems(storeId: string): Promise<Array<ShoppingListItemWithDetails>>;

    /**
     * Insert or update a shopping list item
     * Auto-creates StoreItem if it doesn't exist (by nameNorm)
     * Updates StoreItem usage tracking
     */
    upsertShoppingListItem(params: ShoppingListItemOptionalId): Promise<ShoppingListItem>;

    /**
     * Toggle the checked status of a shopping list item
     */
    toggleShoppingListItemChecked(id: string, isChecked: boolean): Promise<void>;

    /**
     * Delete a shopping list item
     */
    deleteShoppingListItem(id: string): Promise<void>;

    /**
     * Remove a shopping list item without deleting the associated store item
     * Used when moving items between stores
     */
    removeShoppingListItem(id: string): Promise<void>;

    /**
     * Clear all checked items from a shopping list for a store
     */
    clearCheckedShoppingListItems(storeId: string): Promise<void>;
}

/**
 * Combined database interface with both core and entity operations
 */
export interface Database extends CoreDatabase, EntityDatabase, DatabaseEvents {}
