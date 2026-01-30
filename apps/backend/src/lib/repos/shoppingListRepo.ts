import type { ShoppingListItem, ShoppingListItemWithDetails } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for ShoppingListItem entity operations.
 */

// ========== Boolean Conversion Helpers ==========
// SQLite stores booleans as integers (1) or null
// We use null for false to save space and make intent clearer
// These helpers ensure type safety between database and application layers

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

export function getShoppingListItems(storeId: string): ShoppingListItemWithDetails[] {
    const rows = db
        .prepare(
            `SELECT
                sli.id, sli.storeId, sli.storeItemId, sli.qty, sli.unitId, sli.notes,
                sli.isChecked, sli.checkedAt, sli.isSample, sli.isUnsure, sli.isIdea, sli.snoozedUntil,
                sli.createdById, sli.updatedById, sli.createdAt, sli.updatedAt,
                si.name as itemName,
                qu.abbreviation as unitAbbreviation,
                s.id as sectionId,
                COALESCE(s.aisleId, si.aisleId) as aisleId,
                s.name as sectionName,
                s.sortOrder as sectionSortOrder,
                a.name as aisleName,
                a.sortOrder as aisleSortOrder
             FROM ShoppingListItem sli
             LEFT JOIN StoreItem si ON sli.storeItemId = si.id
             LEFT JOIN QuantityUnit qu ON sli.unitId = qu.id
             LEFT JOIN StoreSection s ON si.sectionId = s.id
             LEFT JOIN StoreAisle a ON COALESCE(s.aisleId, si.aisleId) = a.id
             WHERE sli.storeId = ?
             ORDER BY
                COALESCE(a.sortOrder, 999999) ASC,
                COALESCE(s.sortOrder, 999999) ASC,
                sli.createdAt ASC`
        )
        .all(storeId) as any[];

    // Convert SQLite integers to booleans
    return rows.map((row) => ({
        ...row,
        isChecked: intToBool(row.isChecked),
        isSample: row.isSample != null ? intToBool(row.isSample) : null,
        isUnsure: row.isUnsure != null ? intToBool(row.isUnsure) : null,
        isIdea: intToBool(row.isIdea),
    }));
}

export function upsertShoppingListItem(params: {
    id?: string;
    storeId: string;
    storeItemId?: string | null;
    qty?: number | null;
    unitId?: string | null;
    notes?: string | null;
    isChecked?: boolean;
    isIdea?: boolean;
    isSample?: boolean | null;
    isUnsure?: boolean | null;
    snoozedUntil?: string | null;
    userId: string;
}): ShoppingListItem {
    const now = new Date().toISOString();

    // Apply defaults
    const isChecked = params.isChecked ?? false;
    const isIdea = params.isIdea ?? false;
    const isSample = params.isSample ?? null;
    const isUnsure = params.isUnsure ?? null;

    if (params.id) {
        // Update existing
        const existing = db
            .prepare(
                `SELECT id, storeId, storeItemId, qty, unitId, notes, isChecked, checkedAt, isSample, isUnsure, isIdea, snoozedUntil, createdById, updatedById, createdAt, updatedAt
                 FROM ShoppingListItem
                 WHERE id = ?`
            )
            .get(params.id) as ShoppingListItem | undefined;

        if (!existing) {
            throw new Error(`Shopping list item ${params.id} not found`);
        }

        // Compute checkedAt based on state change
        let checkedAt = existing.checkedAt;
        if (isChecked !== existing.isChecked) {
            checkedAt = isChecked ? now : null;
        }

        // Clear snoozedUntil if item is checked
        const snoozedUntil = isChecked ? null : params.snoozedUntil;

        db.prepare(
            `UPDATE ShoppingListItem
             SET storeItemId = ?, qty = ?, unitId = ?, notes = ?, isChecked = ?, checkedAt = ?,
                 isSample = ?, isUnsure = ?, isIdea = ?, snoozedUntil = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(
            params.storeItemId,
            params.qty,
            params.unitId,
            params.notes,
            boolToInt(isChecked),
            checkedAt,
            boolToInt(isSample),
            boolToInt(isUnsure),
            boolToInt(isIdea),
            snoozedUntil,
            params.userId,
            now,
            params.id
        );

        return getShoppingListItemById(params.id)!;
    } else {
        // Create new
        const id = crypto.randomUUID();
        const checkedAt = isChecked ? now : null;
        // Clear snoozedUntil if item is checked
        const snoozedUntil = isChecked ? null : (params.snoozedUntil ?? null);

        db.prepare(
            `INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isChecked, checkedAt, isSample, isUnsure, isIdea, snoozedUntil, createdById, updatedById, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            id,
            params.storeId,
            params.storeItemId ?? null,
            params.qty ?? null,
            params.unitId ?? null,
            params.notes ?? null,
            boolToInt(isChecked),
            checkedAt,
            boolToInt(isSample),
            boolToInt(isUnsure),
            boolToInt(isIdea),
            snoozedUntil,
            params.userId,
            params.userId,
            now,
            now
        );

        return getShoppingListItemById(id)!;
    }
}

export function getShoppingListItemById(id: string): ShoppingListItem | null {
    const row = db
        .prepare(
            `SELECT id, storeId, storeItemId, qty, unitId, notes, isChecked, checkedAt, isSample, isUnsure, isIdea, snoozedUntil, createdById, updatedById, createdAt, updatedAt
             FROM ShoppingListItem
             WHERE id = ?`
        )
        .get(id) as any | undefined;

    if (!row) return null;

    // Convert SQLite integers to booleans
    return {
        ...row,
        isChecked: intToBool(row.isChecked),
        isSample: row.isSample != null ? intToBool(row.isSample) : null,
        isUnsure: row.isUnsure != null ? intToBool(row.isUnsure) : null,
        isIdea: intToBool(row.isIdea),
    };
}

export function toggleShoppingListItemChecked(
    id: string,
    isChecked: boolean,
    userId: string
): void {
    const now = new Date().toISOString();

    if (isChecked) {
        // When checking: update checked fields AND clear snooze
        db.prepare(
            `UPDATE ShoppingListItem
             SET isChecked = ?, checkedAt = ?, snoozedUntil = NULL, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(boolToInt(isChecked), now, userId, now, id);
    } else {
        // When unchecking: only update checked fields, leave snoozedUntil alone
        db.prepare(
            `UPDATE ShoppingListItem
             SET isChecked = ?, checkedAt = NULL, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(boolToInt(isChecked), userId, now, id);
    }
}

/**
 * Remove a shopping list item (does NOT delete the store item)
 */
export function removeShoppingListItem(id: string): boolean {
    const result = db.prepare(`DELETE FROM ShoppingListItem WHERE id = ?`).run(id);
    return result.changes > 0;
}

/**
 * Delete a shopping list item AND its associated store item
 */
export function deleteShoppingListItem(id: string): boolean {
    // Get the store item ID before deleting the shopping list item
    const shoppingListItem = db
        .prepare(`SELECT storeItemId FROM ShoppingListItem WHERE id = ?`)
        .get(id) as { storeItemId: string | null } | undefined;

    if (!shoppingListItem) {
        return false;
    }

    // Delete the shopping list item
    const result = db.prepare(`DELETE FROM ShoppingListItem WHERE id = ?`).run(id);

    // Delete the store item if it exists
    if (shoppingListItem.storeItemId) {
        db.prepare(`DELETE FROM StoreItem WHERE id = ?`).run(shoppingListItem.storeItemId);
    }

    return result.changes > 0;
}

export function clearCheckedShoppingListItems(storeId: string): number {
    const result = db
        .prepare(`DELETE FROM ShoppingListItem WHERE storeId = ? AND isChecked = 1`)
        .run(storeId);

    return result.changes;
}
