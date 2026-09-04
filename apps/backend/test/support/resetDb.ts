import { db } from "../../src/lib/db/db";

/**
 * Tables the setup file seeds as reference data. Wiping these would break any suite that
 * joins a shopping-list item to its unit, and they are never mutated by application code.
 */
const PRESERVED_TABLES = new Set(["QuantityUnit", "_migrations"]);

/**
 * Empty every application table, for use in a `beforeEach`.
 *
 * Each test *file* already gets a fresh `:memory:` schema (Vitest's `isolate: true` re-runs
 * the setup file per file), so this only exists for per-test isolation within a file.
 *
 * Deliberately not a transaction-per-test: `storeService`, `storeRepo` and
 * `planService.dispatchPlan` open their own `db.transaction()`, and better-sqlite3 degrades a
 * nested transaction to a savepoint — so a rollback inside a repo would silently unwind the
 * *test's* outer transaction instead of the repo's, and the failure would look like a data bug.
 * DELETE on a sub-millisecond in-memory database is not worth that hazard.
 */
export const resetDb = (): void => {
    const tables = (
        db
            .prepare(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
            )
            .all() as { name: string }[]
    )
        .map((t) => t.name)
        .filter((name) => !PRESERVED_TABLES.has(name));

    // Foreign keys off for the duration: the tables are unordered, so a child-before-parent
    // delete would otherwise trip RESTRICT constraints.
    db.pragma("foreign_keys = OFF");
    try {
        for (const table of tables) {
            db.prepare(`DELETE FROM "${table}"`).run();
        }
    } finally {
        db.pragma("foreign_keys = ON");
    }
};
