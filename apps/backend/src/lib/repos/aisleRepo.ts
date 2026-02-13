import type { StoreAisle } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for StoreAisle entity operations.
 */

export function createAisle(params: {
    storeId: string;
    name: string;
    sortOrder: number;
    createdById: string;
}): StoreAisle {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.storeId,
        params.name,
        params.sortOrder,
        params.createdById,
        params.createdById,
        now,
        now
    );

    return getAisleById(id)!;
}

export function getAisleById(id: string): StoreAisle | null {
    const row = db
        .prepare(
            `SELECT id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt
             FROM StoreAisle
             WHERE id = ?`
        )
        .get(id) as StoreAisle | undefined;

    return row ?? null;
}

export function getAislesByStore(storeId: string): StoreAisle[] {
    return db
        .prepare(
            `SELECT id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt
             FROM StoreAisle
             WHERE storeId = ?
             ORDER BY sortOrder ASC, name ASC`
        )
        .all(storeId) as StoreAisle[];
}

export function updateAisle(params: {
    id: string;
    name: string;
    updatedById: string;
}): StoreAisle | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE StoreAisle
             SET name = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.name, params.updatedById, now, params.id);

    if (result.changes === 0) {
        return null;
    }

    return getAisleById(params.id);
}

export function updateAisleSortOrder(params: {
    id: string;
    sortOrder: number;
    updatedById: string;
}): StoreAisle | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE StoreAisle
             SET sortOrder = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.sortOrder, params.updatedById, now, params.id);

    if (result.changes === 0) {
        return null;
    }

    return getAisleById(params.id);
}

export function reorderAisles(updates: Array<{ id: string; sortOrder: number }>): void {
    const stmt = db.prepare(`UPDATE StoreAisle SET sortOrder = ? WHERE id = ?`);

    db.transaction(() => {
        for (const update of updates) {
            stmt.run(update.sortOrder, update.id);
        }
    })();
}

export function deleteAisle(id: string): boolean {
    const result = db.prepare(`DELETE FROM StoreAisle WHERE id = ?`).run(id);
    return result.changes > 0;
}

export function getMaxSortOrder(storeId: string): number {
    const row = db
        .prepare(`SELECT MAX(sortOrder) as maxOrder FROM StoreAisle WHERE storeId = ?`)
        .get(storeId) as { maxOrder: number | null };

    return row.maxOrder ?? -1;
}
