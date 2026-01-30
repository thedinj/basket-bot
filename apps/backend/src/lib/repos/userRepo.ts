import type { User } from "@basket-bot/core";
import { hashPassword, verifyPassword } from "../auth/password";
import { db } from "../db/db";

/**
 * Get user by email (case-insensitive)
 */
export function getUserByEmail(email: string): User | null {
    const row = db
        .prepare(
            `SELECT id, email, name, scopes, createdAt, updatedAt
             FROM User
             WHERE email = ? COLLATE NOCASE`
        )
        .get(email.toLowerCase()) as any;

    if (!row) return null;

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        scopes: row.scopes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
    const row = db
        .prepare(
            `SELECT id, email, name, scopes, createdAt, updatedAt
             FROM User
             WHERE id = ?`
        )
        .get(id) as any;

    if (!row) return null;

    return {
        id: row.id,
        email: row.email,
        name: row.name,
        scopes: row.scopes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Update user profile (name only)
 */
export function updateUserProfile(userId: string, name: string): User | null {
    db.prepare(
        `UPDATE User
         SET name = ?, updatedAt = datetime('now')
         WHERE id = ?`
    ).run(name, userId);

    return getUserById(userId);
}

/**
 * Change user password
 * Verifies current password before updating
 *
 * TODO: Consider invalidating all other sessions (revoke refresh tokens except current)
 * when password changes for better security.
 */
export async function changeUserPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<boolean> {
    // Get current password hash
    const row = db.prepare(`SELECT passwordHash FROM User WHERE id = ?`).get(userId) as
        | { passwordHash: string }
        | undefined;

    if (!row) {
        return false;
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, row.passwordHash);
    if (!isValid) {
        return false;
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update password hash
    db.prepare(
        `UPDATE User
         SET passwordHash = ?, updatedAt = datetime('now')
         WHERE id = ?`
    ).run(newHash, userId);

    return true;
}
