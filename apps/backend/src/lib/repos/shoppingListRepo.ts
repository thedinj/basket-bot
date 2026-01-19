import type { ShoppingListItem, ShoppingListItemWithDetails } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for ShoppingListItem entity operations.
 */

export function getShoppingListItems(storeId: string): ShoppingListItemWithDetails[] {
    return db
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
        .all(storeId) as ShoppingListItemWithDetails[];
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

        db.prepare(
            `UPDATE ShoppingListItem
             SET storeItemId = ?, qty = ?, unitId = ?, notes = ?, isChecked = ?, checkedAt = ?,
                 isSample = ?, isUnsure = ?, isIdea = ?, snoozedUntil = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(
            params.storeItemId ?? existing.storeItemId,
            params.qty ?? existing.qty,
            params.unitId ?? existing.unitId,
            params.notes ?? existing.notes,
            isChecked != null ? (isChecked ? 1 : 0) : null,
            checkedAt,
            isSample != null ? (isSample ? 1 : 0) : null,
            isUnsure != null ? (isUnsure ? 1 : 0) : null,
            isIdea != null ? (isIdea ? 1 : 0) : null,
            params.snoozedUntil ?? existing.snoozedUntil,
            params.userId,
            now,
            params.id
        );

        return getShoppingListItemById(params.id)!;
    } else {
        // Create new
        const id = crypto.randomUUID();
        const checkedAt = isChecked ? now : null;

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
            isChecked != null ? (isChecked ? 1 : 0) : null,
            checkedAt,
            isSample != null ? (isSample ? 1 : 0) : null,
            isUnsure != null ? (isUnsure ? 1 : 0) : null,
            isIdea != null ? (isIdea ? 1 : 0) : null,
            params.snoozedUntil ?? null,
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
        .get(id) as ShoppingListItem | undefined;

    return row ?? null;
}

export function toggleShoppingListItemChecked(
    id: string,
    isChecked: boolean,
    userId: string
): void {
    const now = new Date().toISOString();

    db.prepare(
        `UPDATE ShoppingListItem
         SET isChecked = ?, checkedAt = ?, updatedById = ?, updatedAt = ?
         WHERE id = ?`
    ).run(isChecked ? 1 : null, isChecked ? now : null, userId, now, id);
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
