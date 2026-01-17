import type { Store, StoreCollaborator, StoreCollaboratorDetail } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for Store entity operations.
 * Handles all database access for stores.
 */

export function createStore(params: { name: string; createdById: string }): Store {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Store (id, name, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, params.name, params.createdById, params.createdById, now, now);

    return getStoreById(id)!;
}

export function getStoreById(id: string): Store | null {
    const row = db
        .prepare(
            `SELECT id, name, createdById, updatedById, createdAt, updatedAt
             FROM Store
             WHERE id = ?`
        )
        .get(id) as Store | undefined;

    return row ?? null;
}

export function getStoresByUser(userId: string): Store[] {
    return db
        .prepare(
            `SELECT s.id, s.name, s.createdById, s.updatedById, s.createdAt, s.updatedAt
             FROM Store s
             JOIN StoreCollaborator sc ON s.id = sc.storeId
             WHERE sc.userId = ?
             ORDER BY s.name ASC`
        )
        .all(userId) as Store[];
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
 * Check if a user has access to a store (via collaborator relationship)
 */
export function userHasAccessToStore(userId: string, storeId: string): boolean {
    const row = db
        .prepare(
            `SELECT 1
             FROM StoreCollaborator
             WHERE storeId = ? AND userId = ?`
        )
        .get(storeId, userId);

    return !!row;
}

/**
 * Get user's role for a store (owner, editor, or null if not a collaborator)
 */
export function getUserStoreRole(userId: string, storeId: string): "owner" | "editor" | null {
    const row = db
        .prepare(
            `SELECT role
             FROM StoreCollaborator
             WHERE storeId = ? AND userId = ?`
        )
        .get(storeId, userId) as { role: "owner" | "editor" } | undefined;

    return row?.role ?? null;
}

/**
 * Check if user is the owner of a store
 */
export function userIsStoreOwner(userId: string, storeId: string): boolean {
    return getUserStoreRole(userId, storeId) === "owner";
}

/**
 * Add a collaborator to a store
 */
export function addStoreCollaborator(params: {
    storeId: string;
    userId: string;
    role: "owner" | "editor";
}): StoreCollaborator {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO StoreCollaborator (id, storeId, userId, role, createdAt)
         VALUES (?, ?, ?, ?, ?)`
    ).run(id, params.storeId, params.userId, params.role, now);

    return getStoreCollaboratorById(id)!;
}

/**
 * Get a collaborator by ID
 */
export function getStoreCollaboratorById(id: string): StoreCollaborator | null {
    const row = db
        .prepare(
            `SELECT id, storeId, userId, role, createdAt
             FROM StoreCollaborator
             WHERE id = ?`
        )
        .get(id) as StoreCollaborator | undefined;

    return row ?? null;
}

/**
 * Get all collaborators for a store with user details
 */
export function getStoreCollaborators(storeId: string): StoreCollaboratorDetail[] {
    return db
        .prepare(
            `SELECT
                sc.id, sc.storeId, sc.userId, sc.role, sc.createdAt,
                u.email as userEmail, u.name as userName
             FROM StoreCollaborator sc
             JOIN User u ON sc.userId = u.id
             WHERE sc.storeId = ?
             ORDER BY sc.role DESC, u.name ASC`
        )
        .all(storeId) as StoreCollaboratorDetail[];
}

/**
 * Remove a collaborator from a store
 */
export function removeStoreCollaborator(storeId: string, userId: string): boolean {
    const result = db
        .prepare(
            `DELETE FROM StoreCollaborator
             WHERE storeId = ? AND userId = ?`
        )
        .run(storeId, userId);

    return result.changes > 0;
}

/**
 * Update a collaborator's role
 */
export function updateStoreCollaboratorRole(params: {
    storeId: string;
    userId: string;
    role: "owner" | "editor";
}): boolean {
    const result = db
        .prepare(
            `UPDATE StoreCollaborator
             SET role = ?
             WHERE storeId = ? AND userId = ?`
        )
        .run(params.role, params.storeId, params.userId);

    return result.changes > 0;
}

/**
 * Count the number of owners for a store
 */
export function countStoreOwners(storeId: string): number {
    const row = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM StoreCollaborator
             WHERE storeId = ? AND role = 'owner'`
        )
        .get(storeId) as { count: number };

    return row.count;
}

/**
 * Check if an email is already a collaborator or has a pending invitation
 */
export function isEmailStoreCollaboratorOrInvited(email: string, storeId: string): boolean {
    const row = db
        .prepare(
            `SELECT 1 FROM (
                SELECT 1
                FROM StoreCollaborator sc
                JOIN User u ON sc.userId = u.id
                WHERE sc.storeId = ? AND LOWER(u.email) = LOWER(?)
                UNION
                SELECT 1
                FROM StoreInvitation si
                WHERE si.storeId = ? AND LOWER(si.invitedEmail) = LOWER(?) AND si.status = 'pending'
            ) AS combined
            LIMIT 1`
        )
        .get(storeId, email, storeId, email);

    return !!row;
}
