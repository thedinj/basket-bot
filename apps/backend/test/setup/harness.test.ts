import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { db } from "../../src/lib/db/db";

/**
 * Guards the harness itself. If this file goes red, every other backend suite is suspect —
 * they would silently be running against the on-disk `database.db` instead of `:memory:`.
 */
describe("in-memory db harness", () => {
    it("hands the repos the setup file's in-memory connection", () => {
        expect(db).toBe((globalThis as typeof globalThis & { db?: Database.Database }).db);
        expect(db.memory).toBe(true);
    });

    it("has the full init.ts schema applied", () => {
        const tables = db
            .prepare(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
            )
            .all() as { name: string }[];
        const names = tables.map((t) => t.name);

        expect(names).toEqual(
            expect.arrayContaining([
                "User",
                "Store",
                "StoreAisle",
                "StoreSection",
                "StoreItem",
                "ShoppingListItem",
            ])
        );
    });

    it("enforces foreign keys", () => {
        expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    });
});
