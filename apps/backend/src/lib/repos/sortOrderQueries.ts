import type { Statement } from "better-sqlite3";
import { db } from "../db/db";

/**
 * Shared mechanics for the `sortOrder` columns on StoreAisle and StoreSection.
 *
 * The two repos' reorder and max-lookup functions were byte-identical apart from the table name.
 * Rather than interpolate a table name into SQL, each repo keeps its own prepared statement and
 * passes it in — so the SQL stays static and greppable while the loop, the transaction, and the
 * empty-table convention live in one place.
 */

/**
 * Apply a batch of `{ id, sortOrder }` updates in a single transaction.
 *
 * `stmt` must be an `UPDATE <table> SET sortOrder = ? WHERE id = ?` — parameters are bound in
 * that order. All-or-nothing: a failure part way through leaves the previous order intact rather
 * than a half-renumbered list.
 */
export function applySortOrders(
    stmt: Statement,
    updates: Array<{ id: string; sortOrder: number }>
): void {
    db.transaction(() => {
        for (const update of updates) {
            stmt.run(update.sortOrder, update.id);
        }
    })();
}

/**
 * Highest `sortOrder` in a scope, or **-1** when the scope is empty.
 *
 * -1 rather than 0 so callers can always append with `getMaxSortOrder(...) + 1` and have the
 * first row land at 0.
 *
 * `stmt` must be a `SELECT MAX(sortOrder) as maxOrder FROM <table> WHERE <scope> = ?`.
 */
export function readMaxSortOrder(stmt: Statement, scopeId: string): number {
    const row = stmt.get(scopeId) as { maxOrder: number | null };

    return row.maxOrder ?? -1;
}
