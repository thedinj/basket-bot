import type { User } from "@basket-bot/core";
import { hashPassword, verifyPassword } from "../auth/password";
import { db } from "../db/db";
import { parseSqliteTimestamp } from "../utils/sqliteUtils";

type UserRow = Omit<User, "scopes" | "createdAt" | "updatedAt"> & {
    scopes: string | null;
    createdAt: string;
    updatedAt: string;
};

/** A user row plus the password hash — never leaves the auth path. */
type UserWithPasswordRow = UserRow & { password: string };

/** The public column list for User. Kept in one place so every read maps the same shape. */
const USER_COLUMNS = `id, email, name, scopes, createdAt, updatedAt`;

const toUser = (row: UserRow): User => ({
    id: row.id,
    email: row.email,
    name: row.name,
    scopes: row.scopes ? row.scopes.split(",").filter(Boolean) : [],
    createdAt: parseSqliteTimestamp(row.createdAt),
    updatedAt: parseSqliteTimestamp(row.updatedAt),
});

/**
 * Email is matched case-insensitively everywhere, because addresses are stored as the user typed
 * them at registration. Sign-in and the registration duplicate check must agree on this — when
 * they disagreed, an account created as `Name@Example.com` could not be signed into as
 * `name@example.com`, and could not be re-registered either.
 */
const EMAIL_MATCH = `email = ? COLLATE NOCASE`;

/**
 * Get user by email (case-insensitive)
 */
export function getUserByEmail(email: string): User | null {
    const row = db.prepare(`SELECT ${USER_COLUMNS} FROM User WHERE ${EMAIL_MATCH}`).get(email) as
        | UserRow
        | undefined;

    return row ? toUser(row) : null;
}

/**
 * Get a user by email along with their password hash, for credential verification.
 *
 * Separate from `getUserByEmail` so the hash is only ever fetched on the sign-in path; callers
 * must not return the `password` field to clients.
 */
export function getUserWithPasswordByEmail(
    email: string
): { user: User; passwordHash: string } | null {
    const row = db
        .prepare(`SELECT ${USER_COLUMNS}, password FROM User WHERE ${EMAIL_MATCH}`)
        .get(email) as UserWithPasswordRow | undefined;

    if (!row) return null;

    return { user: toUser(row), passwordHash: row.password };
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
    const row = db.prepare(`SELECT ${USER_COLUMNS} FROM User WHERE id = ?`).get(id) as
        | UserRow
        | undefined;

    return row ? toUser(row) : null;
}

/**
 * Update user profile (name only)
 */
export function updateUserProfile(userId: string, name: string): User | null {
    db.prepare(
        `UPDATE User
         SET name = ?, updatedAt = ?
         WHERE id = ?`
    ).run(name, new Date().toISOString(), userId);

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
    const row = db.prepare(`SELECT password FROM User WHERE id = ?`).get(userId) as
        | { password: string }
        | undefined;

    if (!row) {
        return false;
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, row.password);
    if (!isValid) {
        return false;
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update password hash
    db.prepare(
        `UPDATE User
         SET password = ?, updatedAt = ?
         WHERE id = ?`
    ).run(newHash, new Date().toISOString(), userId);

    return true;
}

/**
 * Get all users (admin only)
 */
export function getAllUsers(): User[] {
    const rows = db
        .prepare(`SELECT ${USER_COLUMNS} FROM User ORDER BY createdAt DESC`)
        .all() as UserRow[];

    return rows.map(toUser);
}
