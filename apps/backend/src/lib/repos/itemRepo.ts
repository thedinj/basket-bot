import type { StoreItem, StoreItemWithDetails } from "@basket-bot/core";
import { db } from "../db/db";
import { intToBool } from "../utils/sqliteUtils";
import { normalizeItemName } from "../utils/stringUtils";

/**
 * Repository for StoreItem entity operations.
 */

export function createItem(params: {
    storeId: string;
    name: string;
    aisleId: string | null;
    sectionId: string | null;
    createdById: string;
}): StoreItem {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const nameNorm = normalizeItemName(params.name);

    // Normalize: store only section when present (null aisle), else store aisle
    const normalizedAisleId = params.sectionId ? null : params.aisleId;
    const normalizedSectionId = params.sectionId;

    db.prepare(
        `INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 0, 0, ?, ?, ?, ?)`
    ).run(
        id,
        params.storeId,
        params.name,
        nameNorm,
        normalizedAisleId,
        normalizedSectionId,
        params.createdById,
        params.createdById,
        now,
        now
    );

    return getItemById(id)!;
}

export function getItemById(id: string): StoreItem | null {
    const row = db
        .prepare(
            `SELECT id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt
             FROM StoreItem
             WHERE id = ?`
        )
        .get(id) as
        | (Omit<StoreItem, "isHidden" | "isFavorite"> & {
              isHidden: number | null;
              isFavorite: number | null;
          })
        | undefined;

    if (!row) return null;

    // Convert SQLite integers to booleans
    return {
        ...row,
        isHidden: intToBool(row.isHidden),
        isFavorite: intToBool(row.isFavorite),
    };
}

export function findItemByNameNorm(
    storeId: string,
    nameNorm: string,
    excludeId: string
): StoreItem | undefined {
    const row = db
        .prepare(
            `SELECT id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt
             FROM StoreItem
             WHERE storeId = ? AND nameNorm = ? AND id != ?`
        )
        .get(storeId, nameNorm, excludeId) as
        | (Omit<StoreItem, "isHidden" | "isFavorite"> & {
              isHidden: number | null;
              isFavorite: number | null;
          })
        | undefined;

    if (!row) return undefined;

    return {
        ...row,
        isHidden: intToBool(row.isHidden),
        isFavorite: intToBool(row.isFavorite),
    };
}

export function getItemsByStore(storeId: string): StoreItem[] {
    const rows = db
        .prepare(
            `SELECT id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt
             FROM StoreItem
             WHERE storeId = ?
             ORDER BY name ASC`
        )
        .all(storeId) as Array<
        Omit<StoreItem, "isHidden" | "isFavorite"> & {
            isHidden: number | null;
            isFavorite: number | null;
        }
    >;

    // Convert SQLite integers to booleans
    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
        isFavorite: intToBool(row.isFavorite),
    }));
}

export function getItemsByStoreWithDetails(storeId: string): StoreItemWithDetails[] {
    const rows = db
        .prepare(
            `SELECT
                si.id, si.storeId, si.name, si.nameNorm,
                COALESCE(s.aisleId, si.aisleId) as aisleId, si.sectionId,
                si.usageCount, si.lastUsedAt, si.isHidden, si.isFavorite,
                si.createdById, si.updatedById, si.createdAt, si.updatedAt,
                s.name as sectionName, s.sortOrder as sectionSortOrder,
                a.name as aisleName, a.sortOrder as aisleSortOrder,
                creator.name as createdByName,
                updater.name as updatedByName
             FROM StoreItem si
             LEFT JOIN StoreSection s ON si.sectionId = s.id
             LEFT JOIN StoreAisle a ON COALESCE(s.aisleId, si.aisleId) = a.id
             LEFT JOIN User creator ON si.createdById = creator.id
             LEFT JOIN User updater ON si.updatedById = updater.id
             WHERE si.storeId = ? AND si.isHidden = 0
             ORDER BY
                COALESCE(a.sortOrder, 999999) ASC,
                COALESCE(s.sortOrder, 999999) ASC,
                si.nameNorm ASC`
        )
        .all(storeId) as Array<
        Omit<StoreItemWithDetails, "isHidden" | "isFavorite"> & {
            isHidden: number | null;
            isFavorite: number | null;
        }
    >;

    // Convert SQLite integers to booleans
    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
        isFavorite: intToBool(row.isFavorite),
    }));
}

export function updateItem(params: {
    id: string;
    name: string;
    aisleId: string | null;
    sectionId: string | null;
    updatedById: string;
}): StoreItem | null {
    const now = new Date().toISOString();
    const nameNorm = normalizeItemName(params.name);

    // Normalize: store only section when present (null aisle), else store aisle
    const normalizedAisleId = params.sectionId ? null : params.aisleId;
    const normalizedSectionId = params.sectionId;

    const result = db
        .prepare(
            `UPDATE StoreItem
             SET name = ?, nameNorm = ?, aisleId = ?, sectionId = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(
            params.name,
            nameNorm,
            normalizedAisleId,
            normalizedSectionId,
            params.updatedById,
            now,
            params.id
        );

    if (result.changes === 0) {
        return null;
    }

    return getItemById(params.id);
}

export function toggleItemFavorite(id: string, userId: string): StoreItem | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE StoreItem
             SET isFavorite = NOT isFavorite, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(userId, now, id);

    if (result.changes === 0) {
        return null;
    }

    return getItemById(id);
}

export function deleteItem(id: string): boolean {
    const result = db.prepare(`DELETE FROM StoreItem WHERE id = ?`).run(id);
    return result.changes > 0;
}

/**
 * An "orphan": an item nobody has placed, kept, or hidden. Declared once so the preview and
 * the delete can never drift apart — the delete re-applies it as its own race guard.
 *
 * `IFNULL(..., 0) = 0` rather than a bare `= 0` because booleans exist in two encodings here:
 * `init.ts` declares these columns `DEFAULT 0`, but the house convention writes `1`/`NULL`.
 * The `sectionId IS NULL` half matters: a sectioned item carries a NULL `aisleId` by design
 * (`updateItem` normalizes it away), so it is categorized despite the null aisle column.
 */
const ORPHAN_PREDICATE = `
    si.aisleId IS NULL
    AND si.sectionId IS NULL
    AND IFNULL(si.isFavorite, 0) = 0
    AND IFNULL(si.isHidden, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM ShoppingListItem sli WHERE sli.storeItemId = si.id)
`;

/** SQLite caps bound parameters per statement; chunk well under it. */
const ORPHAN_DELETE_CHUNK_SIZE = 500;

export function getOrphanItems(storeId: string): StoreItem[] {
    const rows = db
        .prepare(
            `SELECT si.id, si.storeId, si.name, si.nameNorm, si.aisleId, si.sectionId,
                    si.usageCount, si.lastUsedAt, si.isHidden, si.isFavorite,
                    si.createdById, si.updatedById, si.createdAt, si.updatedAt
             FROM StoreItem si
             WHERE si.storeId = ? AND ${ORPHAN_PREDICATE}
             ORDER BY si.nameNorm ASC`
        )
        .all(storeId) as Array<
        Omit<StoreItem, "isHidden" | "isFavorite"> & {
            isHidden: number | null;
            isFavorite: number | null;
        }
    >;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
        isFavorite: intToBool(row.isFavorite),
    }));
}

/** Deletes only the given ids that still satisfy `ORPHAN_PREDICATE`. Returns how many went. */
export function deleteOrphanItems(storeId: string, ids: string[]): number {
    if (ids.length === 0) {
        return 0;
    }

    const deleteAll = db.transaction(() => {
        let deleted = 0;

        for (let offset = 0; offset < ids.length; offset += ORPHAN_DELETE_CHUNK_SIZE) {
            const chunk = ids.slice(offset, offset + ORPHAN_DELETE_CHUNK_SIZE);
            const placeholders = chunk.map(() => "?").join(", ");
            const result = db
                .prepare(
                    `DELETE FROM StoreItem AS si
                     WHERE si.storeId = ?
                       AND si.id IN (${placeholders})
                       AND ${ORPHAN_PREDICATE}`
                )
                .run(storeId, ...chunk);
            deleted += result.changes;
        }

        return deleted;
    });

    return deleteAll();
}

/**
 * Merges loserId into winnerId: repoints the loser's shopping list rows onto the winner
 * (multiple rows for the same item are fine, e.g. separate entries from different recipes),
 * combines usage/visibility state, fills in the winner's aisle/section from the loser if the
 * winner has neither set, then deletes the loser. Otherwise leaves the winner's name/aisle/
 * section untouched.
 */
export function mergeItemInto(loserId: string, winnerId: string): StoreItem | null {
    const merge = db.transaction(() => {
        const loser = getItemById(loserId);
        const winner = getItemById(winnerId);
        if (!loser || !winner) {
            return winner;
        }

        db.prepare(`UPDATE ShoppingListItem SET storeItemId = ? WHERE storeItemId = ?`).run(
            winnerId,
            loserId
        );

        const now = new Date().toISOString();
        const lastUsedAt =
            !winner.lastUsedAt || (loser.lastUsedAt && loser.lastUsedAt > winner.lastUsedAt)
                ? loser.lastUsedAt
                : winner.lastUsedAt;

        // Winner's own location wins if it has one; otherwise adopt the loser's, keeping
        // aisle/section mutually exclusive (section implies null aisle) like createItem/updateItem.
        const winnerHasLocation = winner.aisleId !== null || winner.sectionId !== null;
        const aisleId = winnerHasLocation ? winner.aisleId : loser.sectionId ? null : loser.aisleId;
        const sectionId = winnerHasLocation ? winner.sectionId : loser.sectionId;

        db.prepare(
            `UPDATE StoreItem
             SET aisleId = ?, sectionId = ?, usageCount = ?, lastUsedAt = ?, isFavorite = ?, isHidden = ?, updatedAt = ?
             WHERE id = ?`
        ).run(
            aisleId,
            sectionId,
            (winner.usageCount || 0) + (loser.usageCount || 0),
            lastUsedAt,
            winner.isFavorite || loser.isFavorite ? 1 : 0,
            winner.isHidden && loser.isHidden ? 1 : 0,
            now,
            winnerId
        );

        db.prepare(`DELETE FROM StoreItem WHERE id = ?`).run(loserId);

        return getItemById(winnerId);
    });

    return merge();
}

export function searchStoreItems(storeId: string, searchTerm: string, limit = 20): StoreItem[] {
    const normalizedSearch = normalizeItemName(searchTerm);
    const searchPattern = `%${normalizedSearch}%`;
    const startsWithPattern = `${normalizedSearch}%`;

    const rows = db
        .prepare(
            `SELECT id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt
             FROM StoreItem
             WHERE storeId = ? AND nameNorm LIKE ? AND isHidden = 0
             ORDER BY
                CASE WHEN nameNorm LIKE ? THEN 0 ELSE 1 END,
                usageCount DESC,
                lastUsedAt DESC,
                nameNorm ASC
             LIMIT ?`
        )
        .all(storeId, searchPattern, startsWithPattern, limit) as Array<
        Omit<StoreItem, "isHidden" | "isFavorite"> & {
            isHidden: number | null;
            isFavorite: number | null;
        }
    >;

    // Convert SQLite integers to booleans
    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
        isFavorite: intToBool(row.isFavorite),
    }));
}

export function getOrCreateStoreItemByName(params: {
    storeId: string;
    name: string;
    aisleId?: string | null;
    sectionId?: string | null;
    createdById: string;
}): StoreItem {
    const nameNorm = normalizeItemName(params.name);
    const now = new Date().toISOString();

    // Try to find existing item
    const row = db
        .prepare(
            `SELECT id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt
             FROM StoreItem
             WHERE storeId = ? AND nameNorm = ?`
        )
        .get(params.storeId, nameNorm) as
        | (Omit<StoreItem, "isHidden" | "isFavorite"> & {
              isHidden: number | null;
              isFavorite: number | null;
          })
        | undefined;

    const existing = row
        ? {
              ...row,
              isHidden: intToBool(row.isHidden),
              isFavorite: intToBool(row.isFavorite),
          }
        : undefined;

    if (existing) {
        // Update usage count, last_used_at, and location if provided
        const normalizedAisleId = params.sectionId ? null : (params.aisleId ?? existing.aisleId);
        const normalizedSectionId = params.sectionId ?? existing.sectionId;

        db.prepare(
            `UPDATE StoreItem
             SET usageCount = ?, lastUsedAt = ?, aisleId = ?, sectionId = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        ).run(
            (existing.usageCount || 0) + 1,
            now,
            normalizedAisleId,
            normalizedSectionId,
            params.createdById,
            now,
            existing.id
        );

        return getItemById(existing.id)!;
    }

    // Create new item
    return createItem({
        storeId: params.storeId,
        name: params.name,
        aisleId: params.aisleId ?? null,
        sectionId: params.sectionId ?? null,
        createdById: params.createdById,
    });
}
