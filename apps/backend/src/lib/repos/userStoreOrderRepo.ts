import { db } from "../db/db";

/**
 * Repository for per-user store ordering (UserStoreOrder).
 * Stores each user's custom sort order for the shopping-list store tabs.
 */

export function setStoreOrder(
    userId: string,
    updates: Array<{ storeId: string; sortOrder: number }>
): void {
    const stmt = db.prepare(
        `INSERT INTO UserStoreOrder (id, userId, storeId, sortOrder, updatedAt)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(userId, storeId)
         DO UPDATE SET sortOrder = excluded.sortOrder, updatedAt = CURRENT_TIMESTAMP`
    );

    db.transaction(() => {
        for (const update of updates) {
            stmt.run(crypto.randomUUID(), userId, update.storeId, update.sortOrder);
        }
    })();
}
