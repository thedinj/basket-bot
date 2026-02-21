import type { Store } from "@basket-bot/core";
import { db } from "../db/db";
import { normalizeItemName } from "../utils/stringUtils";

/**
 * Repository for Store entity operations.
 * Handles all database access for stores.
 */

// Boolean conversion helpers for SQLite
// We use null for false to save space and make intent clearer

/**
 * Convert a boolean to SQLite value (1 for true, null for false)
 */
function boolToInt(value: boolean | null | undefined): number | null {
    if (value == null || !value) return null;
    return 1;
}

/**
 * Convert SQLite value to boolean (1 → true, null/0 → false)
 */
function intToBool(value: number | null | undefined): boolean {
    if (value == null) return false;
    return value !== 0;
}

export function createStore(params: {
    name: string;
    createdById: string;
    householdId?: string | null;
}): Store {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Store (id, name, householdId, isHidden, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.name,
        params.householdId ?? null,
        null, // isHidden defaults to false (NULL)
        params.createdById,
        params.createdById,
        now,
        now
    );

    return getStoreById(id)!;
}

export function getStoreById(id: string): Store | null {
    const row = db
        .prepare(
            `SELECT id, name, householdId, isHidden, createdById, updatedById, createdAt, updatedAt
             FROM Store
             WHERE id = ?`
        )
        .get(id) as (Omit<Store, "isHidden"> & { isHidden: number | null }) | undefined;

    if (!row) return null;

    return {
        ...row,
        isHidden: intToBool(row.isHidden),
    };
}

export function getStoresByUser(userId: string): Store[] {
    const rows = db
        .prepare(
            `SELECT DISTINCT s.id, s.name, s.householdId, s.isHidden, s.createdById, s.updatedById, s.createdAt, s.updatedAt
             FROM Store s
             LEFT JOIN HouseholdMember hm ON s.householdId = hm.householdId AND hm.userId = ?
             WHERE s.createdById = ? OR hm.userId IS NOT NULL
             ORDER BY s.name ASC`
        )
        .all(userId, userId) as Array<Omit<Store, "isHidden"> & { isHidden: number | null }>;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
    }));
}

export function updateStore(params: {
    id: string;
    name: string;
    updatedById: string;
}): Store | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE Store
             SET name = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.name, params.updatedById, now, params.id);

    if (result.changes === 0) {
        return null;
    }

    return getStoreById(params.id);
}

export function deleteStore(id: string): boolean {
    const result = db.prepare(`DELETE FROM Store WHERE id = ?`).run(id);
    return result.changes > 0;
}

/**
 * Duplicate a store with its aisles, sections, and optionally items.
 * Creates a new store owned by the specified user with copied layout.
 * The new store is private (householdId = null) by default.
 * Does not copy shopping list items.
 * @throws Error if source store doesn't exist or user lacks access
 * @throws Error if ID mappings fail (data integrity issue)
 */
export function duplicateStore(params: {
    sourceStoreId: string;
    newStoreName: string;
    userId: string;
    includeItems: boolean;
}): Store {
    const newStoreId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Execute all operations in a transaction for atomicity
    db.transaction(() => {
        // 1. Create the new store (private by default, visible)
        db.prepare(
            `INSERT INTO Store (id, name, householdId, isHidden, createdById, updatedById, createdAt, updatedAt)
             VALUES (?, ?, NULL, NULL, ?, ?, ?, ?)`
        ).run(newStoreId, params.newStoreName, params.userId, params.userId, now, now);

        // 2. Copy aisles and build ID mapping
        const aisleIdMap = new Map<string, string>();
        const sourceAisles = db
            .prepare(
                `SELECT id, name, sortOrder
                 FROM StoreAisle
                 WHERE storeId = ?
                 ORDER BY sortOrder ASC`
            )
            .all(params.sourceStoreId) as Array<{ id: string; name: string; sortOrder: number }>;

        const aisleInsertStmt = db.prepare(
            `INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const aisle of sourceAisles) {
            const newAisleId = crypto.randomUUID();
            aisleIdMap.set(aisle.id, newAisleId);
            aisleInsertStmt.run(
                newAisleId,
                newStoreId,
                aisle.name,
                aisle.sortOrder,
                params.userId,
                params.userId,
                now,
                now
            );
        }

        // 3. Copy sections with mapped aisle IDs
        const sourceSections = db
            .prepare(
                `SELECT id, aisleId, name, sortOrder
                 FROM StoreSection
                 WHERE storeId = ?
                 ORDER BY sortOrder ASC`
            )
            .all(params.sourceStoreId) as Array<{
            id: string;
            aisleId: string;
            name: string;
            sortOrder: number;
        }>;

        const sectionIdMap = new Map<string, string>();
        const sectionInsertStmt = db.prepare(
            `INSERT INTO StoreSection (id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const section of sourceSections) {
            const newSectionId = crypto.randomUUID();
            const newAisleId = aisleIdMap.get(section.aisleId);

            // Fail explicitly if aisle mapping is missing (data integrity issue)
            if (!newAisleId) {
                throw new Error(
                    `Failed to map aisle ID ${section.aisleId} for section "${section.name}". Data integrity issue.`
                );
            }

            sectionIdMap.set(section.id, newSectionId);
            sectionInsertStmt.run(
                newSectionId,
                newStoreId,
                newAisleId,
                section.name,
                section.sortOrder,
                params.userId,
                params.userId,
                now,
                now
            );
        }

        // 4. Optionally copy items with mapped aisle/section IDs
        if (params.includeItems) {
            const sourceItems = db
                .prepare(
                    `SELECT name, aisleId, sectionId, isHidden, isFavorite
                     FROM StoreItem
                     WHERE storeId = ?`
                )
                .all(params.sourceStoreId) as Array<{
                name: string;
                aisleId: string | null;
                sectionId: string | null;
                isHidden: number | null;
                isFavorite: number | null;
            }>;

            const itemInsertStmt = db.prepare(
                `INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?)`
            );

            for (const item of sourceItems) {
                const newItemId = crypto.randomUUID();
                const nameNorm = normalizeItemName(item.name);

                // Map section/aisle IDs to new store, fail if mapping missing
                let newAisleId: string | null = null;
                let newSectionId: string | null = null;

                if (item.sectionId) {
                    newSectionId = sectionIdMap.get(item.sectionId) ?? null;
                    if (!newSectionId) {
                        throw new Error(
                            `Failed to map section ID ${item.sectionId} for item "${item.name}". Data integrity issue.`
                        );
                    }
                    // Apply normalization: if section exists, clear aisle
                    newAisleId = null;
                } else if (item.aisleId) {
                    newAisleId = aisleIdMap.get(item.aisleId) ?? null;
                    if (!newAisleId) {
                        throw new Error(
                            `Failed to map aisle ID ${item.aisleId} for item "${item.name}". Data integrity issue.`
                        );
                    }
                }

                itemInsertStmt.run(
                    newItemId,
                    newStoreId,
                    item.name,
                    nameNorm,
                    newAisleId,
                    newSectionId,
                    item.isHidden ?? 0,
                    item.isFavorite ?? 0,
                    params.userId,
                    params.userId,
                    now,
                    now
                );
            }
        }
    })();

    return getStoreById(newStoreId)!;
}

/**
 * Check if a user has access to a store (creator or household member)
 */
export function userHasAccessToStore(userId: string, storeId: string): boolean {
    const row = db
        .prepare(
            `SELECT 1
             FROM Store s
             LEFT JOIN HouseholdMember hm ON s.householdId = hm.householdId AND hm.userId = ?
             WHERE s.id = ? AND (s.createdById = ? OR hm.userId IS NOT NULL)`
        )
        .get(userId, storeId, userId);

    return !!row;
}

/**
 * Update a store's household association (set or clear)
 */
export function updateStoreHousehold(params: {
    storeId: string;
    householdId: string | null;
    updatedById: string;
}): Store | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE Store
             SET householdId = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.householdId, params.updatedById, now, params.storeId);

    if (result.changes === 0) {
        return null;
    }

    return getStoreById(params.storeId);
}

/**
 * Update a store's visibility (hide/show)
 */
export function updateStoreVisibility(params: {
    storeId: string;
    isHidden: boolean;
    updatedById: string;
}): Store | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE Store
             SET isHidden = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(boolToInt(params.isHidden), params.updatedById, now, params.storeId);

    if (result.changes === 0) {
        return null;
    }

    return getStoreById(params.storeId);
}
