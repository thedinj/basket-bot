import {
    CapacitorSQLite,
    SQLiteConnection,
    SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { AppSetting } from "../models/AppSetting";
import {
    getInitializedStore,
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

const DB_NAME = "shopping_assistant";

const migrations: Array<{ version: number; up: string[] }> = [
    {
        version: 3,
        up: [
            `PRAGMA foreign_keys = ON;`,

            `CREATE TABLE IF NOT EXISTS app_setting (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL,
         updated_at TEXT NOT NULL DEFAULT (datetime('now'))
       );`,

            `CREATE TABLE IF NOT EXISTS quantity_unit (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         abbreviation TEXT NOT NULL,
         sort_order INTEGER NOT NULL,
         category TEXT NOT NULL
       );`,

            // Insert initial quantity units
            // TODO: Rework to use QUANTITY_UNITS, but watch out for injection
            `INSERT INTO quantity_unit (id, name, abbreviation, sort_order, category) VALUES
            ('gram', 'Gram', 'g', 10, 'weight'),
            ('kilogram', 'Kilogram', 'kg', 11, 'weight'),
            ('milligram', 'Milligram', 'mg', 9, 'weight'),
            ('ounce', 'Ounce', 'oz', 12, 'weight'),
            ('pound', 'Pound', 'lb', 13, 'weight'),
            ('milliliter', 'Milliliter', 'ml', 20, 'volume'),
            ('liter', 'Liter', 'l', 21, 'volume'),
            ('fluid-ounce', 'Fluid Ounce', 'fl oz', 22, 'volume'),
            ('gallon', 'Gallon', 'gal', 23, 'volume'),
            ('cup', 'Cup', 'cup', 24, 'volume'),
            ('tablespoon', 'Tablespoon', 'tbsp', 25, 'volume'),
            ('teaspoon', 'Teaspoon', 'tsp', 26, 'volume'),
            ('count', 'Count', 'ct', 30, 'count'),
            ('dozen', 'Dozen', 'doz', 31, 'count'),
            ('package', 'Package', 'pkg', 40, 'package'),
            ('can', 'Can', 'can', 41, 'package'),
            ('box', 'Box', 'box', 42, 'package'),
            ('bag', 'Bag', 'bag', 43, 'package'),
            ('bottle', 'Bottle', 'btl', 44, 'package'),
            ('jar', 'Jar', 'jar', 45, 'package'),
            ('bunch', 'Bunch', 'bunch', 50, 'other');`,

            `CREATE TABLE IF NOT EXISTS store (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now'))
       );`,

            `CREATE TABLE IF NOT EXISTS store_aisle (
         id TEXT PRIMARY KEY,
         store_id TEXT NOT NULL,
         name TEXT NOT NULL,
         sort_order INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now')),
         FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE
       );`,

            `CREATE TABLE IF NOT EXISTS store_section (
         id TEXT PRIMARY KEY,
         store_id TEXT NOT NULL,
         aisle_id TEXT NOT NULL,
         name TEXT NOT NULL,
         sort_order INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now')),
         FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
         FOREIGN KEY (aisle_id) REFERENCES store_aisle(id) ON DELETE CASCADE
       );`,

            `CREATE TABLE IF NOT EXISTS store_item (
         id TEXT PRIMARY KEY,
         store_id TEXT NOT NULL,
         name TEXT NOT NULL,
         name_norm TEXT NOT NULL,
         aisle_id TEXT,
         section_id TEXT,
         usage_count INTEGER NOT NULL DEFAULT 0,
         last_used_at TEXT,
         is_hidden INTEGER NOT NULL DEFAULT 0,
         is_favorite INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now')),
         FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
         FOREIGN KEY (aisle_id) REFERENCES store_aisle(id) ON DELETE SET NULL,
         FOREIGN KEY (section_id) REFERENCES store_section(id) ON DELETE SET NULL
       );`,

            `CREATE UNIQUE INDEX IF NOT EXISTS ux_store_item_store_norm
         ON store_item(store_id, name_norm);`,

            `CREATE TABLE IF NOT EXISTS shopping_list_item (
         id TEXT PRIMARY KEY,
         store_id TEXT NOT NULL,
         store_item_id TEXT,
         qty REAL,
         unit_id TEXT,
         notes TEXT,
         is_checked INTEGER NOT NULL DEFAULT 0,
         checked_at TEXT,
         is_sample INTEGER,
         is_idea INTEGER NOT NULL DEFAULT 0,
         snoozed_until TEXT,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now')),
         FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
         FOREIGN KEY (store_item_id) REFERENCES store_item(id) ON DELETE CASCADE,
         FOREIGN KEY (unit_id) REFERENCES quantity_unit(id) ON DELETE SET NULL
       );`,

            `CREATE INDEX IF NOT EXISTS ix_list_item_store_checked
         ON shopping_list_item(store_id, is_checked, updated_at);`,
        ],
    },
];

/**
 * SQLite implementation of the Database interface
 */
export class SQLiteDatabase extends BaseDatabase {
    private sqlite: SQLiteConnection;
    private connection: SQLiteDBConnection | null = null;
    private initPromise: Promise<void> | null = null;

    constructor() {
        super();
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }

    private async getUserVersion(conn: SQLiteDBConnection): Promise<number> {
        const res = await conn.query(`PRAGMA user_version;`);
        return (res.values?.[0]?.user_version as number) ?? 0;
    }

    private async setUserVersion(conn: SQLiteDBConnection, v: number) {
        await conn.execute(`PRAGMA user_version = ${v};`);
    }

    private async runMigrations(conn: SQLiteDBConnection) {
        const current = await this.getUserVersion(conn);

        const pending = migrations
            .filter((m) => m.version > current)
            .sort((a, b) => a.version - b.version);
        if (!pending.length) return;

        for (const m of pending) {
            for (const stmt of m.up) await conn.execute(stmt);
            await this.setUserVersion(conn, m.version);
        }
    }

    private async getConnection(): Promise<SQLiteDBConnection> {
        if (this.connection) {
            return this.connection;
        }

        if (this.initPromise) {
            await this.initPromise;
            if (!this.connection) {
                throw new Error("Failed to initialize database connection");
            }
            return this.connection;
        }

        throw new Error("Database not initialized. Call initialize() first.");
    }

    protected async initializeStorage(): Promise<void> {
        if (this.connection) {
            return; // Already initialized
        }

        if (this.initPromise) {
            return this.initPromise; // Already initializing
        }

        this.initPromise = (async () => {
            let conn: SQLiteDBConnection | null = null;
            try {
                conn = await this.sqlite.createConnection(
                    DB_NAME,
                    false,
                    "no-encryption",
                    1, // Leave the SQLite version as 1, handle migrations manually
                    false
                );
                await conn.open();
                await this.runMigrations(conn);
                //await this.insertInitialQuantityUnits(conn);

                this.connection = conn;
            } catch (err) {
                if (conn) {
                    try {
                        await conn.close();
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (err) {
                        // Ignore close errors during cleanup
                    }
                }
                throw err;
            } finally {
                this.initPromise = null;
                this.notifyChange();
            }
        })();

        return this.initPromise;
    }

    async close(): Promise<void> {
        if (!this.connection) {
            if (this.initPromise) {
                await this.initPromise;
                if (!this.connection) {
                    this.initPromise = null;
                    return;
                }
            } else {
                return;
            }
        }

        await this.connection.close();
        await this.sqlite.closeConnection(DB_NAME, false);
        this.connection = null;
        this.initPromise = null;
        this.notifyChange();
    }

    async reset(
        tablesToPersist: string[] = DEFAULT_TABLES_TO_PERSIST
    ): Promise<void> {
        const conn = await this.getConnection();

        const tablesToDelete = [
            "shopping_list_item",
            "store_item",
            "store_section",
            "store_aisle",
            "store",
            "app_setting",
        ].filter((t) => !tablesToPersist.includes(t));

        for (const t of tablesToDelete) {
            await conn.execute(`DELETE FROM ${t};`);
        }

        await this.ensureInitialData();
        this.notifyChange();
    }

    protected async hasStores(): Promise<boolean> {
        const conn = await this.getConnection();
        const storeCountRes = await conn.query(
            "SELECT COUNT(*) as count FROM store"
        );
        const count = storeCountRes.values?.[0]?.count ?? 0;
        return count > 0;
    }

    // ========== Store Operations ==========
    async insertStore(name: string, conn?: SQLiteDBConnection): Promise<Store> {
        const connToUse = conn ?? (await this.getConnection());
        const newStore = getInitializedStore(name);

        await connToUse.run(
            "INSERT INTO store (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            [
                newStore.id,
                newStore.name,
                newStore.created_at,
                newStore.updated_at,
            ]
        );
        this.notifyChange();
        return newStore;
    }

    async loadAllQuantityUnits(): Promise<QuantityUnit[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, name, abbreviation, sort_order, category FROM quantity_unit ORDER BY sort_order"
        );
        return (res.values || []) as QuantityUnit[];
    }

    async loadAllStores(): Promise<Store[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, name, created_at, updated_at FROM store ORDER BY name COLLATE NOCASE"
        );
        return res.values || [];
    }

    async getStoreById(id: string): Promise<Store | null> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, name, created_at, updated_at FROM store WHERE id = ?",
            [id]
        );
        return res.values?.[0] || null;
    }

    async updateStore(id: string, name: string): Promise<Store> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        await conn.run(
            "UPDATE store SET name = ?, updated_at = ? WHERE id = ?",
            [name, updated_at, id]
        );

        const store = await this.getStoreById(id);
        if (!store) {
            throw new Error(`Store with id ${id} not found`);
        }
        this.notifyChange();
        return store;
    }

    async deleteStore(id: string): Promise<void> {
        const conn = await this.getConnection();

        await conn.run("DELETE FROM store WHERE id = ?", [id]);
        this.notifyChange();
    }

    // ========== App Settings Operations ==========
    async getAppSetting(key: string): Promise<AppSetting | null> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT key, value, updated_at FROM app_setting WHERE key = ?",
            [key]
        );
        return res.values?.[0] || null;
    }

    async setAppSetting(key: string, value: string): Promise<void> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        await conn.run(
            `INSERT INTO app_setting (key, value, updated_at) 
             VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
            [key, value, updated_at, value, updated_at]
        );
        this.notifyChange();
    }

    // ========== StoreAisle Operations ==========
    async insertAisle(storeId: string, name: string): Promise<StoreAisle> {
        const conn = await this.getConnection();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        // Get max sort_order for this store
        const maxRes = await conn.query(
            "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM store_aisle WHERE store_id = ?",
            [storeId]
        );
        const sort_order = (maxRes.values?.[0]?.max_order ?? -1) + 1;

        await conn.run(
            "INSERT INTO store_aisle (id, store_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [id, storeId, name, sort_order, now, now]
        );

        this.notifyChange();
        return {
            id,
            store_id: storeId,
            name,
            sort_order,
            created_at: now,
            updated_at: now,
        };
    }

    async getAislesByStore(storeId: string): Promise<StoreAisle[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, store_id, name, sort_order, created_at, updated_at FROM store_aisle WHERE store_id = ? ORDER BY sort_order",
            [storeId]
        );
        return res.values || [];
    }

    async getAisleById(id: string): Promise<StoreAisle | null> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, store_id, name, sort_order, created_at, updated_at FROM store_aisle WHERE id = ?",
            [id]
        );
        return res.values?.[0] || null;
    }

    async updateAisle(id: string, name: string): Promise<StoreAisle> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        await conn.run(
            "UPDATE store_aisle SET name = ?, updated_at = ? WHERE id = ?",
            [name, updated_at, id]
        );

        const aisle = await this.getAisleById(id);
        if (!aisle) {
            throw new Error(`Aisle with id ${id} not found`);
        }
        this.notifyChange();
        return aisle;
    }

    async deleteAisle(id: string): Promise<void> {
        const conn = await this.getConnection();

        await conn.run("DELETE FROM store_aisle WHERE id = ?", [id]);
        this.notifyChange();
    }

    async reorderAisles(
        updates: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        for (const { id, sort_order } of updates) {
            await conn.run(
                "UPDATE store_aisle SET sort_order = ?, updated_at = ? WHERE id = ?",
                [sort_order, updated_at, id]
            );
        }
        this.notifyChange();
    }

    // ========== StoreSection Operations ==========
    async insertSection(
        storeId: string,
        name: string,
        aisleId: string
    ): Promise<StoreSection> {
        const conn = await this.getConnection();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        // Get max sort_order for this aisle
        const maxRes = await conn.query(
            "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM store_section WHERE aisle_id = ?",
            [aisleId]
        );
        const sort_order = (maxRes.values?.[0]?.max_order ?? -1) + 1;

        await conn.run(
            "INSERT INTO store_section (id, store_id, aisle_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [id, storeId, aisleId, name, sort_order, now, now]
        );

        this.notifyChange();
        return {
            id,
            store_id: storeId,
            aisle_id: aisleId,
            name,
            sort_order,
            created_at: now,
            updated_at: now,
        };
    }

    async getSectionsByStore(storeId: string): Promise<StoreSection[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, store_id, aisle_id, name, sort_order, created_at, updated_at FROM store_section WHERE store_id = ? ORDER BY sort_order",
            [storeId]
        );
        return res.values || [];
    }

    async getSectionById(id: string): Promise<StoreSection | null> {
        const conn = await this.getConnection();
        const res = await conn.query(
            "SELECT id, store_id, aisle_id, name, sort_order, created_at, updated_at FROM store_section WHERE id = ?",
            [id]
        );
        return res.values?.[0] || null;
    }

    async updateSection(
        id: string,
        name: string,
        aisleId: string
    ): Promise<StoreSection> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        await conn.run(
            "UPDATE store_section SET name = ?, aisle_id = ?, updated_at = ? WHERE id = ?",
            [name, aisleId, updated_at, id]
        );

        const section = await this.getSectionById(id);
        if (!section) {
            throw new Error(`Section with id ${id} not found`);
        }
        this.notifyChange();
        return section;
    }

    async deleteSection(id: string): Promise<void> {
        const conn = await this.getConnection();

        await conn.run("DELETE FROM store_section WHERE id = ?", [id]);
        this.notifyChange();
    }

    async reorderSections(
        updates: Array<{ id: string; sort_order: number }>
    ): Promise<void> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        for (const { id, sort_order } of updates) {
            await conn.run(
                "UPDATE store_section SET sort_order = ?, updated_at = ? WHERE id = ?",
                [sort_order, updated_at, id]
            );
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
        const conn = await this.getConnection();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const name_norm = normalizeItemName(name);

        // Normalize: store only section when present (null aisle), else store aisle
        const normalizedAisleId = sectionId ? null : aisleId ?? null;
        const normalizedSectionId = sectionId ?? null;

        await conn.run(
            `INSERT INTO store_item (id, store_id, name, name_norm, aisle_id, section_id, usage_count, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
                id,
                storeId,
                name,
                name_norm,
                normalizedAisleId,
                normalizedSectionId,
                now,
                now,
            ]
        );

        this.notifyChange();
        return {
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
    }

    async getItemsByStore(storeId: string): Promise<StoreItem[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            `SELECT id, store_id, name, name_norm, aisle_id, section_id, usage_count, last_used_at, is_hidden, is_favorite, created_at, updated_at 
             FROM store_item 
             WHERE store_id = ? AND is_hidden = 0 
             ORDER BY name_norm`,
            [storeId]
        );
        return res.values || [];
    }

    async getItemsByStoreWithDetails(
        storeId: string
    ): Promise<StoreItemWithDetails[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            `SELECT 
                si.id, si.store_id, si.name, si.name_norm, 
                COALESCE(ss.aisle_id, si.aisle_id) as aisle_id, si.section_id, 
                si.usage_count, si.last_used_at, si.is_hidden, si.is_favorite,
                si.created_at, si.updated_at,
                ss.name as section_name, ss.sort_order as section_sort_order,
                sa.name as aisle_name, sa.sort_order as aisle_sort_order
             FROM store_item si
             LEFT JOIN store_section ss ON si.section_id = ss.id
             LEFT JOIN store_aisle sa ON COALESCE(ss.aisle_id, si.aisle_id) = sa.id
             WHERE si.store_id = ? AND si.is_hidden = 0 
             ORDER BY 
                COALESCE(sa.sort_order, 999999) ASC,
                COALESCE(ss.sort_order, 999999) ASC,
                si.name_norm ASC`,
            [storeId]
        );
        // Convert sort_order values from strings to numbers (SQLite returns them as strings)
        const items = (res.values || []).map((item) => ({
            ...item,
            aisle_sort_order:
                item.aisle_sort_order !== null &&
                item.aisle_sort_order !== undefined
                    ? Number(item.aisle_sort_order)
                    : null,
            section_sort_order:
                item.section_sort_order !== null &&
                item.section_sort_order !== undefined
                    ? Number(item.section_sort_order)
                    : null,
        }));
        return items;
    }

    async getItemById(id: string): Promise<StoreItem | null> {
        const conn = await this.getConnection();
        const res = await conn.query(
            `SELECT id, store_id, name, name_norm, aisle_id, section_id, usage_count, last_used_at, is_hidden, is_favorite, created_at, updated_at 
             FROM store_item 
             WHERE id = ?`,
            [id]
        );
        return res.values?.[0] || null;
    }

    async updateItem(
        id: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();
        const name_norm = normalizeItemName(name);

        // Normalize: store only section when present (null aisle), else store aisle
        const normalizedAisleId = sectionId ? null : aisleId ?? null;
        const normalizedSectionId = sectionId ?? null;

        await conn.run(
            `UPDATE store_item 
             SET name = ?, name_norm = ?, aisle_id = ?, section_id = ?, updated_at = ? 
             WHERE id = ?`,
            [
                name,
                name_norm,
                normalizedAisleId,
                normalizedSectionId,
                updated_at,
                id,
            ]
        );

        const item = await this.getItemById(id);
        if (!item) {
            throw new Error(`Item with id ${id} not found`);
        }
        this.notifyChange();
        return item;
    }

    async toggleItemFavorite(id: string): Promise<StoreItem> {
        const conn = await this.getConnection();
        const updated_at = new Date().toISOString();

        // Toggle the is_favorite field (0 -> 1, 1 -> 0)
        await conn.run(
            `UPDATE store_item 
             SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END, 
                 updated_at = ? 
             WHERE id = ?`,
            [updated_at, id]
        );

        const item = await this.getItemById(id);
        if (!item) {
            throw new Error(`Item with id ${id} not found`);
        }
        this.notifyChange();
        return item;
    }

    async deleteItem(id: string): Promise<void> {
        const conn = await this.getConnection();

        await conn.run("DELETE FROM store_item WHERE id = ?", [id]);
        this.notifyChange();
    }

    // ========== ShoppingList Operations ==========
    async getShoppingListItems(
        storeId: string
    ): Promise<ShoppingListItemWithDetails[]> {
        const conn = await this.getConnection();
        const res = await conn.query(
            `SELECT 
                sli.id, sli.store_id, sli.store_item_id,
                sli.qty, sli.unit_id, sli.notes,
                sli.is_checked, sli.checked_at, sli.is_sample, sli.is_idea,
                sli.snoozed_until,
                sli.created_at, sli.updated_at,
                si.name as item_name,
                qu.abbreviation as unit_abbreviation,
                COALESCE(ss.id, si.section_id) as section_id,
                COALESCE(ss.aisle_id, si.aisle_id) as aisle_id,
                ss.name as section_name, ss.sort_order as section_sort_order,
                sa.name as aisle_name, sa.sort_order as aisle_sort_order
             FROM shopping_list_item sli
             LEFT JOIN store_item si ON sli.store_item_id = si.id
             LEFT JOIN quantity_unit qu ON sli.unit_id = qu.id
             LEFT JOIN store_section ss ON si.section_id = ss.id
             LEFT JOIN store_aisle sa ON COALESCE(ss.aisle_id, si.aisle_id) = sa.id
             WHERE sli.store_id = ?
             ORDER BY 
                sli.is_checked ASC,
                COALESCE(sli.is_idea, 0) DESC,
                COALESCE(sa.sort_order, 999999) ASC,
                COALESCE(ss.sort_order, 999999) ASC,
                COALESCE(si.name, sli.notes, '') ASC`,
            [storeId]
        );
        return res.values || [];
    }

    async getOrCreateStoreItemByName(
        storeId: string,
        name: string,
        aisleId?: string | null,
        sectionId?: string | null
    ): Promise<StoreItem> {
        const conn = await this.getConnection();
        const now = new Date().toISOString();
        const name_norm = normalizeItemName(name);

        // Try to find existing item
        const existingItemRes = await conn.query(
            `SELECT id, store_id, name, name_norm, aisle_id, section_id, usage_count, last_used_at, is_hidden, is_favorite, created_at, updated_at
             FROM store_item 
             WHERE store_id = ? AND name_norm = ?`,
            [storeId, name_norm]
        );

        if (existingItemRes.values && existingItemRes.values.length > 0) {
            const existingItem = existingItemRes.values[0];

            // Update usage count and last_used_at
            // Also update location if provided
            const normalizedAisleId = sectionId
                ? null
                : aisleId ?? existingItem.aisle_id;
            const normalizedSectionId = sectionId ?? existingItem.section_id;

            await conn.run(
                `UPDATE store_item 
                 SET usage_count = ?, last_used_at = ?, aisle_id = ?, section_id = ?, updated_at = ? 
                 WHERE id = ?`,
                [
                    (existingItem.usage_count || 0) + 1,
                    now,
                    normalizedAisleId,
                    normalizedSectionId,
                    now,
                    existingItem.id,
                ]
            );

            // Return updated item
            const updatedRes = await conn.query(
                `SELECT id, store_id, name, name_norm, aisle_id, section_id, usage_count, last_used_at, is_hidden, is_favorite, created_at, updated_at
                 FROM store_item WHERE id = ?`,
                [existingItem.id]
            );
            return updatedRes.values![0];
        } else {
            // Create new item
            return await this.insertItem(storeId, name, aisleId, sectionId);
        }
    }

    async upsertShoppingListItem(
        params: ShoppingListItemOptionalId
    ): Promise<ShoppingListItem> {
        const conn = await this.getConnection();
        const now = new Date().toISOString();

        if (params.id) {
            // Get current is_checked status to enforce no-snooze constraint
            const currentRes = await conn.query(
                `SELECT is_checked FROM shopping_list_item WHERE id = ?`,
                [params.id]
            );
            const isChecked = currentRes.values?.[0]?.is_checked === 1;

            // Update existing shopping list item
            // Clear snoozed_until if item is checked (checked items cannot be snoozed)
            await conn.run(
                `UPDATE shopping_list_item 
                 SET store_item_id = ?, qty = ?, unit_id = ?, notes = ?, is_sample = ?, is_idea = ?, snoozed_until = ?, updated_at = ? 
                 WHERE id = ?`,
                [
                    params.store_item_id || null,
                    params.qty ?? null,
                    params.unit_id || null,
                    params.notes,
                    params.is_sample ?? null,
                    params.is_idea ? 1 : 0,
                    isChecked ? null : params.snoozed_until || null,
                    now,
                    params.id,
                ]
            );

            const itemRes = await conn.query(
                `SELECT id, store_id, store_item_id, qty, unit_id, snoozed_until, notes,
                        is_checked, checked_at, is_sample, is_idea, created_at, updated_at
                 FROM shopping_list_item WHERE id = ?`,
                [params.id]
            );

            this.notifyChange();
            return itemRes.values?.[0];
        } else {
            // Insert new shopping list item
            const id = crypto.randomUUID();

            await conn.run(
                `INSERT INTO shopping_list_item 
                 (id, store_id, store_item_id, qty, unit_id, notes, is_sample, is_idea, snoozed_until, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    params.store_id,
                    params.store_item_id || null,
                    params.qty ?? null,
                    params.unit_id || null,
                    params.notes,
                    params.is_sample ?? null,
                    params.is_idea ? 1 : 0,
                    params.snoozed_until || null,
                    now,
                    now,
                ]
            );

            this.notifyChange();
            return {
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
        }
    }

    async toggleShoppingListItemChecked(
        id: string,
        isChecked: boolean
    ): Promise<void> {
        const conn = await this.getConnection();
        const now = new Date().toISOString();

        // Clear snoozed_until when checking an item (checked items cannot be snoozed)
        await conn.run(
            `UPDATE shopping_list_item 
             SET is_checked = ?, checked_at = ?, snoozed_until = ?, updated_at = ? 
             WHERE id = ?`,
            [
                isChecked ? 1 : 0,
                isChecked ? now : null,
                isChecked ? null : undefined,
                now,
                id,
            ]
        );

        this.notifyChange();
    }

    async deleteShoppingListItem(id: string): Promise<void> {
        const conn = await this.getConnection();

        // First, get the shopping list item to find the store_item_id
        const itemRes = await conn.query(
            "SELECT store_item_id FROM shopping_list_item WHERE id = ?",
            [id]
        );
        const storeItemId = itemRes.values?.[0]?.store_item_id;

        // Delete the shopping list item
        await conn.run("DELETE FROM shopping_list_item WHERE id = ?", [id]);

        // If there was an associated store item, delete it too (cascade)
        if (storeItemId) {
            await this.deleteItem(storeItemId);
        }

        this.notifyChange();
    }

    async removeShoppingListItem(id: string): Promise<void> {
        const conn = await this.getConnection();

        // Only delete the shopping list item, leave the store item intact
        await conn.run("DELETE FROM shopping_list_item WHERE id = ?", [id]);

        this.notifyChange();
    }

    async clearCheckedShoppingListItems(storeId: string): Promise<void> {
        const conn = await this.getConnection();

        await conn.run(
            "DELETE FROM shopping_list_item WHERE store_id = ? AND is_checked = 1",
            [storeId]
        );
        this.notifyChange();
    }

    async searchStoreItems(
        storeId: string,
        searchTerm: string,
        limit: number = 10
    ): Promise<StoreItem[]> {
        const conn = await this.getConnection();
        const searchNorm = normalizeItemName(searchTerm);
        const searchPattern = "%" + searchNorm + "%";
        const startsWithPattern = searchNorm + "%";

        const res = await conn.query(
            `SELECT id, store_id, name, name_norm, aisle_id, section_id, usage_count, last_used_at, is_hidden, is_favorite, created_at, updated_at 
             FROM store_item 
             WHERE store_id = ? AND name_norm LIKE ? AND is_hidden = 0 
             ORDER BY 
                CASE WHEN name_norm LIKE ? THEN 0 ELSE 1 END,
                usage_count DESC, 
                last_used_at DESC, 
                name_norm ASC 
             LIMIT ?`,
            [storeId, searchPattern, startsWithPattern, limit]
        );
        return res.values || [];
    }
}
