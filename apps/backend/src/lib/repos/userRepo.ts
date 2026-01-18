import type { User } from "@basket-bot/core";
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
