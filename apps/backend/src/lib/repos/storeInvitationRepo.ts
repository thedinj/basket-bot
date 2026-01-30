import type {
    StoreCollaboratorRole,
    StoreInvitation,
    StoreInvitationDetail,
    StoreInvitationStatus,
} from "@basket-bot/core";
import { randomUUID } from "crypto";
import { db } from "../db/db";

/**
 * Create a new store invitation
 */
export function createStoreInvitation(params: {
    storeId: string;
    invitedEmail: string;
    invitedById: string;
    role: StoreCollaboratorRole;
}): StoreInvitation {
    const invitationId = randomUUID();
    const token = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO StoreInvitation (id, storeId, invitedEmail, invitedById, role, token, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
        invitationId,
        params.storeId,
        params.invitedEmail.toLowerCase(),
        params.invitedById,
        params.role,
        token,
        now
    );

    return {
        id: invitationId,
        storeId: params.storeId,
        invitedEmail: params.invitedEmail.toLowerCase(),
        invitedById: params.invitedById,
        role: params.role,
        token,
        status: "pending",
        createdAt: now,
    };
}

/**
 * Get an invitation by token
 */
export function getStoreInvitationByToken(token: string): StoreInvitation | null {
    const row = db
        .prepare(
            `SELECT id, storeId, invitedEmail, invitedById, role, token, status, createdAt
             FROM StoreInvitation
             WHERE token = ?`
        )
        .get(token) as any;

    if (!row) return null;

    return {
        id: row.id,
        storeId: row.storeId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        role: row.role,
        token: row.token,
        status: row.status,
        createdAt: row.createdAt,
    };
}

/**
 * Get pending invitations for a user by email with details
 */
export function getUserPendingStoreInvitations(email: string): StoreInvitationDetail[] {
    const rows = db
        .prepare(
            `SELECT
                i.id,
                i.storeId,
                i.invitedEmail,
                i.invitedById,
                i.role,
                i.token,
                i.status,
                i.createdAt,
                s.name as storeName,
                u.name as inviterName,
                u.email as inviterEmail
             FROM StoreInvitation i
             JOIN Store s ON i.storeId = s.id
             JOIN User u ON i.invitedById = u.id
             WHERE i.invitedEmail = ? COLLATE NOCASE AND i.status = 'pending'
             ORDER BY i.createdAt DESC`
        )
        .all(email.toLowerCase()) as any[];

    return rows.map((row) => ({
        id: row.id,
        storeId: row.storeId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        role: row.role,
        token: row.token,
        status: row.status as StoreInvitationStatus,
        createdAt: row.createdAt,
        storeName: row.storeName,
        inviterName: row.inviterName,
        inviterEmail: row.inviterEmail,
    }));
}

/**
 * Get count of pending invitations for a user by email
 */
export function countUserPendingStoreInvitations(email: string): number {
    const row = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM StoreInvitation
             WHERE invitedEmail = ? COLLATE NOCASE AND status = 'pending'`
        )
        .get(email.toLowerCase()) as { count: number };

    return row.count;
}

/**
 * Get pending invitations for a store with details (for store owners to see outgoing invitations)
 */
export function getStoreInvitationsWithDetails(storeId: string): StoreInvitationDetail[] {
    const rows = db
        .prepare(
            `SELECT
                i.id,
                i.storeId,
                i.invitedEmail,
                i.invitedById,
                i.role,
                i.token,
                i.status,
                i.createdAt,
                s.name as storeName,
                u.name as inviterName,
                u.email as inviterEmail
             FROM StoreInvitation i
             JOIN Store s ON i.storeId = s.id
             JOIN User u ON i.invitedById = u.id
             WHERE i.storeId = ? AND i.status = 'pending'
             ORDER BY i.createdAt DESC`
        )
        .all(storeId) as any[];

    return rows.map((row) => ({
        id: row.id,
        storeId: row.storeId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        role: row.role,
        token: row.token,
        status: row.status as StoreInvitationStatus,
        createdAt: row.createdAt,
        storeName: row.storeName,
        inviterName: row.inviterName,
        inviterEmail: row.inviterEmail,
    }));
}

/**
 * Get an invitation by ID
 */
export function getStoreInvitationById(invitationId: string): StoreInvitation | null {
    const row = db
        .prepare(
            `SELECT id, storeId, invitedEmail, invitedById, role, token, status, createdAt
             FROM StoreInvitation
             WHERE id = ?`
        )
        .get(invitationId) as any;

    if (!row) return null;

    return {
        id: row.id,
        storeId: row.storeId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        role: row.role,
        token: row.token,
        status: row.status,
        createdAt: row.createdAt,
    };
}

/**
 * Update invitation status
 */
export function updateStoreInvitationStatus(
    invitationId: string,
    status: StoreInvitationStatus
): StoreInvitation | null {
    const result = db
        .prepare(
            `UPDATE StoreInvitation
             SET status = ?
             WHERE id = ?`
        )
        .run(status, invitationId);

    if (result.changes === 0) return null;

    const row = db
        .prepare(
            `SELECT id, storeId, invitedEmail, invitedById, role, token, status, createdAt
             FROM StoreInvitation
             WHERE id = ?`
        )
        .get(invitationId) as any;

    return {
        id: row.id,
        storeId: row.storeId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        role: row.role,
        token: row.token,
        status: row.status,
        createdAt: row.createdAt,
    };
}

/**
 * Delete an invitation
 */
export function deleteStoreInvitation(invitationId: string): boolean {
    const result = db.prepare(`DELETE FROM StoreInvitation WHERE id = ?`).run(invitationId);
    return result.changes > 0;
}

/**
 * Check if an email is already invited or a collaborator of a store
 */
export function isEmailStoreInvitedOrCollaborator(storeId: string, email: string): boolean {
    // Check if already a collaborator
    const collaboratorRow = db
        .prepare(
            `SELECT 1
             FROM StoreCollaborator sc
             JOIN User u ON sc.userId = u.id
             WHERE sc.storeId = ? AND u.email = ? COLLATE NOCASE`
        )
        .get(storeId, email.toLowerCase());

    if (collaboratorRow) return true;

    // Check if already has pending invitation
    const inviteRow = db
        .prepare(
            `SELECT 1
             FROM StoreInvitation
             WHERE storeId = ? AND invitedEmail = ? COLLATE NOCASE AND status = 'pending'`
        )
        .get(storeId, email.toLowerCase());

    return !!inviteRow;
}
