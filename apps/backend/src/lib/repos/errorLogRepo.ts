import { db } from "../db/db";

/**
 * Repository for the ErrorLog table.
 * Persists server-side error details so admins can review recent failures.
 */

export interface ErrorLogEntry {
    requestId: string;
    userId?: string | null;
    route: string;
    method: string;
    statusCode: number;
    code: string;
    message: string;
    stack?: string | null;
}

export interface ErrorLogRow extends ErrorLogEntry {
    id: string;
    createdAt: string;
}

export function insertErrorLog(entry: ErrorLogEntry): void {
    db.prepare(
        `INSERT INTO ErrorLog (id, requestId, userId, route, method, statusCode, code, message, stack, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        crypto.randomUUID(),
        entry.requestId,
        entry.userId ?? null,
        entry.route,
        entry.method,
        entry.statusCode,
        entry.code,
        entry.message.slice(0, 1000),
        entry.stack ? entry.stack.slice(0, 4000) : null,
        new Date().toISOString()
    );
}

export function listRecentErrorLogs(params?: {
    limit?: number;
    userId?: string;
    route?: string;
    since?: string;
}): ErrorLogRow[] {
    const limit = params?.limit ?? 100;
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params?.userId) {
        conditions.push("userId = ?");
        values.push(params.userId);
    }
    if (params?.route) {
        conditions.push("route = ?");
        values.push(params.route);
    }
    if (params?.since) {
        conditions.push("createdAt >= ?");
        values.push(params.since);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return db
        .prepare(
            `SELECT id, requestId, userId, route, method, statusCode, code, message, stack, createdAt
             FROM ErrorLog
             ${where}
             ORDER BY createdAt DESC
             LIMIT ?`
        )
        .all(...values, limit) as ErrorLogRow[];
}
