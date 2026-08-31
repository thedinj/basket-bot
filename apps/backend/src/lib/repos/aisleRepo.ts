import type { StoreAisle } from "@basket-bot/core";
import { db } from "../db/db";
import { normalizeItemName } from "../utils/stringUtils";
import { applySortOrders, readMaxSortOrder } from "./sortOrderQueries";

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
    const nameNorm = normalizeItemName(params.name);

    db.prepare(
        `INSERT INTO StoreAisle (id, storeId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.storeId,
        params.name,
        nameNorm,
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
            `SELECT id, storeId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt
             FROM StoreAisle
             WHERE id = ?`
        )
        .get(id) as StoreAisle | undefined;

    return row ?? null;
}

export function findAisleByNameNorm(
    storeId: string,
    nameNorm: string,
    excludeId: string
): StoreAisle | undefined {
    return db
        .prepare(
            `SELECT id, storeId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt
             FROM StoreAisle
             WHERE storeId = ? AND nameNorm = ? AND id != ?`
        )
        .get(storeId, nameNorm, excludeId) as StoreAisle | undefined;
}

export function getAislesByStore(storeId: string): StoreAisle[] {
    return db
        .prepare(
            `SELECT id, storeId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt
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
    const nameNorm = normalizeItemName(params.name);

    const result = db
        .prepare(
            `UPDATE StoreAisle
             SET name = ?, nameNorm = ?, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(params.name, nameNorm, params.updatedById, now, params.id);

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
    applySortOrders(db.prepare(`UPDATE StoreAisle SET sortOrder = ? WHERE id = ?`), updates);
}

export function deleteAisle(id: string): boolean {
    const result = db.prepare(`DELETE FROM StoreAisle WHERE id = ?`).run(id);
    return result.changes > 0;
}

export function getMaxSortOrder(storeId: string): number {
    return readMaxSortOrder(
        db.prepare(`SELECT MAX(sortOrder) as maxOrder FROM StoreAisle WHERE storeId = ?`),
        storeId
    );
}
