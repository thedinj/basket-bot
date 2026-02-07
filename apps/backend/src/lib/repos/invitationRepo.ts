import type { HouseholdInvitation, InvitationDetail, InvitationStatus } from "@basket-bot/core";
import { randomUUID } from "crypto";
import { db } from "../db/db";

/**
 * Create a new invitation
 */
export function createInvitation(params: {
    householdId: string;
    invitedEmail: string;
    invitedById: string;
}): HouseholdInvitation {
    const invitationId = randomUUID();
    const token = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO HouseholdInvitation (id, householdId, invitedEmail, invitedById, token, status, createdAt)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
        invitationId,
        params.householdId,
        params.invitedEmail.toLowerCase(),
        params.invitedById,
        token,
        now
    );

    return {
        id: invitationId,
        householdId: params.householdId,
        invitedEmail: params.invitedEmail.toLowerCase(),
        invitedById: params.invitedById,
        token,
        status: "pending",
        createdAt: new Date(now),
    };
}

/**
 * Get an invitation by token
 */
export function getInvitationByToken(token: string): HouseholdInvitation | null {
    const row = db
        .prepare(
            `SELECT id, householdId, invitedEmail, invitedById, token, status, createdAt
             FROM HouseholdInvitation
             WHERE token = ?`
        )
        .get(token) as any;

    if (!row) return null;

    return {
        id: row.id,
        householdId: row.householdId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        token: row.token,
        status: row.status,
        createdAt: new Date(row.createdAt),
    };
}

/**
 * Get pending invitations for a user by email
 */
export function getUserPendingInvitations(email: string): InvitationDetail[] {
    const rows = db
        .prepare(
            `SELECT
                i.id,
                i.householdId,
                i.invitedEmail,
                i.invitedById,
                i.token,
                i.status,
                i.createdAt,
                h.name as householdName,
                u.name as inviterName
             FROM HouseholdInvitation i
             JOIN Household h ON i.householdId = h.id
             JOIN User u ON i.invitedById = u.id
             WHERE i.invitedEmail = ? COLLATE NOCASE AND i.status = 'pending'
             ORDER BY i.createdAt DESC`
        )
        .all(email.toLowerCase()) as any[];

    return rows.map((row) => ({
        id: row.id,
        householdId: row.householdId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        token: row.token,
        status: row.status as InvitationStatus,
        createdAt: new Date(row.createdAt),
        householdName: row.householdName,
        inviterName: row.inviterName,
    }));
}

/**
 * Get all pending invitations for a household
 */
export function getHouseholdPendingInvitations(householdId: string): HouseholdInvitation[] {
    const rows = db
        .prepare(
            `SELECT id, householdId, invitedEmail, invitedById, token, status, createdAt
             FROM HouseholdInvitation
             WHERE householdId = ? AND status = 'pending'
             ORDER BY createdAt DESC`
        )
        .all(householdId) as any[];

    return rows.map((row) => ({
        id: row.id,
        householdId: row.householdId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        token: row.token,
        status: row.status as InvitationStatus,
        createdAt: new Date(row.createdAt),
    }));
}

/**
 * Update invitation status
 */
export function updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus
): HouseholdInvitation | null {
    const result = db
        .prepare(
            `UPDATE HouseholdInvitation
             SET status = ?
             WHERE id = ?`
        )
        .run(status, invitationId);

    if (result.changes === 0) return null;

    const row = db
        .prepare(
            `SELECT id, householdId, invitedEmail, invitedById, token, status, createdAt
             FROM HouseholdInvitation
             WHERE id = ?`
        )
        .get(invitationId) as any;

    return {
        id: row.id,
        householdId: row.householdId,
        invitedEmail: row.invitedEmail,
        invitedById: row.invitedById,
        token: row.token,
        status: row.status,
        createdAt: new Date(row.createdAt),
    };
}

/**
 * Delete an invitation
 */
export function deleteInvitation(invitationId: string): boolean {
    const result = db.prepare(`DELETE FROM HouseholdInvitation WHERE id = ?`).run(invitationId);
    return result.changes > 0;
}

/**
 * Check if an email is already invited or a member of a household
 */
export function isEmailInvitedOrMember(householdId: string, email: string): boolean {
    // Check if already a member
    const memberRow = db
        .prepare(
            `SELECT 1
             FROM HouseholdMember hm
             JOIN User u ON hm.userId = u.id
             WHERE hm.householdId = ? AND u.email = ? COLLATE NOCASE`
        )
        .get(householdId, email.toLowerCase());

    if (memberRow) return true;

    // Check if already has pending invitation
    const inviteRow = db
        .prepare(
            `SELECT 1
             FROM HouseholdInvitation
             WHERE householdId = ? AND invitedEmail = ? COLLATE NOCASE AND status = 'pending'`
        )
        .get(householdId, email.toLowerCase());

    return !!inviteRow;
}
