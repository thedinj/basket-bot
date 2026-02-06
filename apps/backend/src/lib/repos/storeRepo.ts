import type { Store, StoreCollaborator, StoreCollaboratorDetail } from "@basket-bot/core";
import { db } from "../db/db";
import { normalizeItemName } from "../utils/stringUtils";

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
 * Duplicate a store with its aisles, sections, and optionally items.
 * Creates a new store owned by the specified user with copied layout.
 * Does not copy collaborators or shopping list items.
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
        // 1. Create the new store
        db.prepare(
            `INSERT INTO Store (id, name, createdById, updatedById, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(newStoreId, params.newStoreName, params.userId, params.userId, now, now);

        // 2. Add user as owner collaborator
        const collaboratorId = crypto.randomUUID();
        db.prepare(
            `INSERT INTO StoreCollaborator (id, storeId, userId, role, createdAt)
             VALUES (?, ?, ?, 'owner', ?)`
        ).run(collaboratorId, newStoreId, params.userId, now);

        // 3. Copy aisles and build ID mapping
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

        // 4. Copy sections with mapped aisle IDs
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

        // 5. Optionally copy items with mapped aisle/section IDs
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
