import type { StoreSection } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for StoreSection entity operations.
 */

export function createSection(params: {
    storeId: string;
    aisleId: string;
    name: string;
    sortOrder: number;
    createdById: string;
}): StoreSection {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO StoreSection (id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.storeId,
        params.aisleId,
        params.name,
        params.sortOrder,
        params.createdById,
        params.createdById,
        now,
        now
    );

    return getSectionById(id)!;
}

export function getSectionById(id: string): StoreSection | null {
    const row = db
        .prepare(
            `SELECT id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt
             FROM StoreSection
             WHERE id = ?`
        )
        .get(id) as StoreSection | undefined;

    return row ?? null;
}

export function getSectionsByStore(storeId: string): StoreSection[] {
    return db
        .prepare(
            `SELECT id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt
             FROM StoreSection
             WHERE storeId = ?
             ORDER BY sortOrder ASC, name ASC`
        )
        .all(storeId) as StoreSection[];
}

export function updateSection(params: {
    id: string;
    name: string;
    aisleId: string;
    updatedById: string;
}): StoreSection | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE StoreSection
             SET name = ?, aisleId = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.name, params.aisleId, params.updatedById, now, params.id);

    if (result.changes === 0) {
        return null;
    }

    return getSectionById(params.id);
}

export function reorderSections(updates: Array<{ id: string; sortOrder: number }>): void {
    const stmt = db.prepare(`UPDATE StoreSection SET sortOrder = ? WHERE id = ?`);

    db.transaction(() => {
        for (const update of updates) {
            stmt.run(update.sortOrder, update.id);
        }
    })();
}

export function deleteSection(id: string): boolean {
    const result = db.prepare(`DELETE FROM StoreSection WHERE id = ?`).run(id);
    return result.changes > 0;
}

export function getMaxSortOrder(aisleId: string): number {
    const row = db
        .prepare(`SELECT MAX(sortOrder) as maxOrder FROM StoreSection WHERE aisleId = ?`)
        .get(aisleId) as { maxOrder: number | null };

    return row.maxOrder ?? -1;
}
