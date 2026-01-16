import type { Store } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for Store entity operations.
 * Handles all database access for stores.
 */

export function createStore(params: {
    householdId: string;
    name: string;
    createdById: string;
}): Store {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Store (id, householdId, name, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, params.householdId, params.name, params.createdById, params.createdById, now, now);

    return getStoreById(id)!;
}

export function getStoreById(id: string): Store | null {
    const row = db
        .prepare(
            `SELECT id, householdId, name, createdById, updatedById, createdAt, updatedAt
             FROM Store
             WHERE id = ?`
        )
        .get(id) as Store | undefined;

    return row ?? null;
}

export function getStoresByHousehold(householdId: string): Store[] {
    return db
        .prepare(
            `SELECT id, householdId, name, createdById, updatedById, createdAt, updatedAt
             FROM Store
             WHERE householdId = ?
             ORDER BY name ASC`
        )
        .all(householdId) as Store[];
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
 * Check if a user has access to a store (via household membership)
 */
export function userHasAccessToStore(userId: string, storeId: string): boolean {
    const row = db
        .prepare(
            `SELECT 1
             FROM Store s
             JOIN HouseholdMember hm ON s.householdId = hm.householdId
             WHERE s.id = ? AND hm.userId = ?`
        )
        .get(storeId, userId);

    return !!row;
}
