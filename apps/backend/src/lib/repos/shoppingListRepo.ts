import type {
    CheckConflictResult,
    ShoppingListItem,
    ShoppingListItemWithDetails,
} from "@basket-bot/core";
import { NotFoundError } from "@basket-bot/core";
import { db } from "../db/db";
import { boolToInt, intToBool } from "../utils/sqliteUtils";

/**
 * Repository for ShoppingListItem entity operations.
 */

type ShoppingListItemRow = Omit<
    ShoppingListItem,
    "isChecked" | "isSample" | "isUnsure" | "isIdea" | "isPrivate"
> & {
    isChecked: number;
    isSample: number | null;
    isUnsure: number | null;
    isIdea: number;
    isPrivate: number | null;
};

type ShoppingListItemWithDetailsRow = Omit<
    ShoppingListItemWithDetails,
    "isChecked" | "isSample" | "isUnsure" | "isIdea" | "isFavorite" | "isPrivate"
> & {
    isChecked: number;
    isSample: number | null;
    isUnsure: number | null;
    isIdea: number;
    isFavorite: number | null;
    isPrivate: number | null;
};

function mapRowToShoppingListItem(row: ShoppingListItemRow): ShoppingListItem {
    const isIdea = intToBool(row.isIdea);
    return {
        ...row,
        isIdea,
        isChecked: intToBool(row.isChecked),
        isSample: row.isSample != null ? intToBool(row.isSample) : null,
        isUnsure: row.isUnsure != null ? intToBool(row.isUnsure) : null,
        isPrivate: row.isPrivate != null ? intToBool(row.isPrivate) : null,
        // Ideas have no store item, quantity, or unit
        storeItemId: isIdea ? null : row.storeItemId,
        qty: isIdea ? null : row.qty,
        unitId: isIdea ? null : row.unitId,
    };
}

function mapRowToShoppingListItemWithDetails(
    row: ShoppingListItemWithDetailsRow
): ShoppingListItemWithDetails {
    const isIdea = intToBool(row.isIdea);
    return {
        ...row,
        isIdea,
        isChecked: intToBool(row.isChecked),
        isSample: row.isSample != null ? intToBool(row.isSample) : null,
        isUnsure: row.isUnsure != null ? intToBool(row.isUnsure) : null,
        isFavorite: row.isFavorite != null ? intToBool(row.isFavorite) : null,
        isPrivate: row.isPrivate != null ? intToBool(row.isPrivate) : null,
        // Ideas have no store item, quantity, or unit
        storeItemId: isIdea ? null : row.storeItemId,
        qty: isIdea ? null : row.qty,
        unitId: isIdea ? null : row.unitId,
        unitAbbreviation: isIdea ? null : row.unitAbbreviation,
    };
}

export function getShoppingListItems(
    storeId: string,
    userId: string
): ShoppingListItemWithDetails[] {
    const rows = db
        .prepare(
            `SELECT
                sli.id, sli.storeId, sli.storeItemId, sli.qty, sli.unitId, sli.notes,
                sli.isChecked, sli.checkedAt, sli.checkedBy, sli.checkedUpdatedAt, sli.isSample, sli.isUnsure, sli.isIdea, sli.snoozedUntil, sli.isPrivate,
                sli.createdById, sli.updatedById, sli.createdAt, sli.updatedAt,
                si.name as itemName,
                si.isFavorite as isFavorite,
                si.createdAt as storeItemCreatedAt,
                si.updatedAt as storeItemUpdatedAt,
                qu.abbreviation as unitAbbreviation,
                s.id as sectionId,
                COALESCE(s.aisleId, si.aisleId) as aisleId,
                s.name as sectionName,
                s.sortOrder as sectionSortOrder,
                a.name as aisleName,
                a.sortOrder as aisleSortOrder,
                u.name as checkedByName,
                sli_creator.name as createdByName,
                sli_updater.name as updatedByName,
                si_creator.name as storeItemCreatedByName,
                si_updater.name as storeItemUpdatedByName
             FROM ShoppingListItem sli
             LEFT JOIN StoreItem si ON sli.storeItemId = si.id
             LEFT JOIN QuantityUnit qu ON sli.unitId = qu.id
             LEFT JOIN StoreSection s ON si.sectionId = s.id
             LEFT JOIN StoreAisle a ON COALESCE(s.aisleId, si.aisleId) = a.id
             LEFT JOIN User u ON sli.checkedBy = u.id
             LEFT JOIN User sli_creator ON sli.createdById = sli_creator.id
             LEFT JOIN User sli_updater ON sli.updatedById = sli_updater.id
             LEFT JOIN User si_creator ON si.createdById = si_creator.id
             LEFT JOIN User si_updater ON si.updatedById = si_updater.id
             WHERE sli.storeId = ? AND (sli.isPrivate IS NULL OR sli.isPrivate = 0 OR sli.createdById = ?)
             ORDER BY
                COALESCE(a.sortOrder, 999999) ASC,
                COALESCE(s.sortOrder, 999999) ASC,
                sli.createdAt ASC`
        )
        .all(storeId, userId) as ShoppingListItemWithDetailsRow[];

    return rows.map(mapRowToShoppingListItemWithDetails);
}

/**
 * Throws NotFoundError if the item is private and belongs to someone other than userId,
 * so a collaborator who learns/guesses the id can't distinguish "private" from "doesn't exist".
 */
function assertOwnerIfPrivate(id: string, userId: string): void {
    const row = db
        .prepare(`SELECT isPrivate, createdById FROM ShoppingListItem WHERE id = ?`)
        .get(id) as { isPrivate: number | null; createdById: string } | undefined;

    if (!row) {
        throw new NotFoundError("Shopping list item not found");
    }

    if (intToBool(row.isPrivate) && row.createdById !== userId) {
        throw new NotFoundError("Shopping list item not found");
    }
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
    isPrivate?: boolean | null;
    snoozedUntil?: string | null;
    userId: string;
}): ShoppingListItem {
    const now = new Date().toISOString();

    // Apply defaults
    const isChecked = params.isChecked ?? false;
    const isIdea = params.isIdea ?? false;
    const isSample = params.isSample ?? null;
    const isUnsure = params.isUnsure ?? null;
    const isPrivate = params.isPrivate ?? null;

    // Ideas have no store item, quantity, or unit
    const storeItemId = isIdea ? null : (params.storeItemId ?? null);
    const qty = isIdea ? null : (params.qty ?? null);
    const unitId = isIdea ? null : (params.unitId ?? null);

    if (params.id) {
        // Update existing
        const existing = db
            .prepare(
                `SELECT id, storeId, storeItemId, qty, unitId, notes, isChecked, checkedAt, checkedBy, checkedUpdatedAt, isSample, isUnsure, isIdea, snoozedUntil, isPrivate, createdById, updatedById, createdAt, updatedAt
                 FROM ShoppingListItem
                 WHERE id = ?`
            )
            .get(params.id) as ShoppingListItem | undefined;

        if (!existing) {
            throw new NotFoundError(`Shopping list item ${params.id} not found`);
        }

        // Only the item's creator may change its privacy — otherwise silently keep the
        // existing value so a non-owner can't hide someone else's item from them via update.
        const isPrivateToPersist =
            existing.createdById === params.userId ? boolToInt(isPrivate) : existing.isPrivate;

        // Compute checkedAt, checkedBy, and checkedUpdatedAt based on state change
        let checkedAt = existing.checkedAt;
        let checkedBy = existing.checkedBy;
        let checkedUpdatedAt = existing.checkedUpdatedAt;
        if (isChecked !== existing.isChecked) {
            checkedAt = isChecked ? now : null;
            checkedBy = isChecked ? params.userId : null;
            checkedUpdatedAt = now;
        }

        // Clear snoozedUntil if item is checked
        const snoozedUntil = isChecked ? null : params.snoozedUntil;

        db.prepare(
            `UPDATE ShoppingListItem
             SET storeItemId = ?, qty = ?, unitId = ?, notes = ?, isChecked = ?, checkedAt = ?, checkedBy = ?, checkedUpdatedAt = ?,
                 isSample = ?, isUnsure = ?, isIdea = ?, snoozedUntil = ?, isPrivate = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(
            storeItemId,
            qty,
            unitId,
            params.notes,
            boolToInt(isChecked),
            checkedAt,
            checkedBy,
            checkedUpdatedAt,
            boolToInt(isSample),
            boolToInt(isUnsure),
            boolToInt(isIdea),
            snoozedUntil,
            isPrivateToPersist,
            params.userId,
            now,
            params.id
        );

        return getShoppingListItemById(params.id)!;
    } else {
        // Create new
        const id = crypto.randomUUID();
        const checkedAt = isChecked ? now : null;
        const checkedBy = isChecked ? params.userId : null;
        const checkedUpdatedAt = isChecked ? now : null;
        // Clear snoozedUntil if item is checked
        const snoozedUntil = isChecked ? null : (params.snoozedUntil ?? null);

        // Increment usage count for the store item if provided
        if (storeItemId) {
            db.prepare(
                `UPDATE StoreItem
                 SET usageCount = usageCount + 1, lastUsedAt = ?, updatedById = ?, updatedAt = ?
                 WHERE id = ?`
            ).run(now, params.userId, now, storeItemId);
        }

        db.prepare(
            `INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isChecked, checkedAt, checkedBy, checkedUpdatedAt, isSample, isUnsure, isIdea, snoozedUntil, isPrivate, createdById, updatedById, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            id,
            params.storeId,
            storeItemId,
            qty,
            unitId,
            params.notes ?? null,
            boolToInt(isChecked),
            checkedAt,
            checkedBy,
            checkedUpdatedAt,
            boolToInt(isSample),
            boolToInt(isUnsure),
            boolToInt(isIdea),
            snoozedUntil,
            boolToInt(isPrivate),
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
            `SELECT id, storeId, storeItemId, qty, unitId, notes, isChecked, checkedAt, checkedBy, checkedUpdatedAt, isSample, isUnsure, isIdea, snoozedUntil, isPrivate, createdById, updatedById, createdAt, updatedAt
             FROM ShoppingListItem
             WHERE id = ?`
        )
        .get(id) as ShoppingListItemRow | undefined;

    if (!row) return null;
    return mapRowToShoppingListItem(row);
}

export function toggleShoppingListItemChecked(
    id: string,
    isChecked: boolean,
    userId: string
): CheckConflictResult {
    assertOwnerIfPrivate(id, userId);

    const now = new Date().toISOString();

    if (isChecked) {
        // Check current state to detect conflicts when checking
        const current = db
            .prepare(
                `SELECT sli.id, sli.isChecked, sli.checkedBy, u.name as checkedByName, si.name as itemName
                 FROM ShoppingListItem sli
                 LEFT JOIN User u ON sli.checkedBy = u.id
                 LEFT JOIN StoreItem si ON sli.storeItemId = si.id
                 WHERE sli.id = ?`
            )
            .get(id) as
            | {
                  id: string;
                  isChecked: number | null;
                  checkedBy: string | null;
                  checkedByName: string | null;
                  itemName: string | null;
              }
            | undefined;

        // If item doesn't exist, throw NotFoundError
        if (!current) {
            throw new NotFoundError("Shopping list item not found");
        }

        const conflict =
            current.isChecked === 1 && current.checkedBy != null && current.checkedBy !== userId;

        // If there's a conflict, don't update the item, just return the conflict info
        if (conflict) {
            return {
                conflict: true,
                itemId: current.id,
                itemName: current.itemName ?? undefined,
                conflictUser: {
                    id: current.checkedBy!,
                    name: current.checkedByName ?? "Unknown user",
                },
            };
        }

        // When checking: update checked fields AND clear snooze
        db.prepare(
            `UPDATE ShoppingListItem
             SET isChecked = ?, checkedAt = ?, checkedBy = ?, checkedUpdatedAt = ?, snoozedUntil = NULL, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(boolToInt(isChecked), now, userId, now, userId, now, id);
    } else {
        // When unchecking: only update checked fields, leave snoozedUntil alone
        const result = db
            .prepare(
                `UPDATE ShoppingListItem
             SET isChecked = ?, checkedAt = NULL, checkedBy = NULL, checkedUpdatedAt = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
            )
            .run(boolToInt(isChecked), now, userId, now, id);

        // If no rows were updated, item doesn't exist
        if (result.changes === 0) {
            throw new NotFoundError("Shopping list item not found");
        }
    }

    return {
        conflict: false,
    };
}

/**
 * Remove a shopping list item (does NOT delete the store item)
 */
export function removeShoppingListItem(id: string, userId: string): void {
    assertOwnerIfPrivate(id, userId);

    const result = db.prepare(`DELETE FROM ShoppingListItem WHERE id = ?`).run(id);

    if (result.changes === 0) {
        throw new NotFoundError("Shopping list item not found");
    }
}

/**
 * Delete a shopping list item AND its associated store item
 */
export function deleteShoppingListItem(id: string, userId: string): boolean {
    assertOwnerIfPrivate(id, userId);

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
