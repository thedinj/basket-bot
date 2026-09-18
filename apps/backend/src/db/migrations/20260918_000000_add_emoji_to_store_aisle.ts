import type { Database } from "better-sqlite3";

/**
 * Migration: Add emoji to StoreAisle
 *
 * An optional plate emoji per aisle (🥬 for Produce), shown in the shopping list's aisle header
 * instead of a number. NULL means none. Validated as a single emoji by the API; the CHECK only
 * bounds the length.
 *
 * Guarded so it's safe to re-run: a database built from the current init.ts already has the
 * column (migrate.test.ts replays the newest migration against exactly that).
 */
const hasEmojiColumn = (db: Database): boolean =>
    (db.prepare(`PRAGMA table_info("StoreAisle")`).all() as Array<{ name: string }>).some(
        (column) => column.name === "emoji"
    );

export function up(db: Database): void {
    if (hasEmojiColumn(db)) return;
    db.exec(`
        ALTER TABLE "StoreAisle" ADD COLUMN "emoji" TEXT CHECK("emoji" IS NULL OR length("emoji") <= 40);
    `);
}

export function down(db: Database): void {
    if (!hasEmojiColumn(db)) return;
    db.prepare(`ALTER TABLE "StoreAisle" DROP COLUMN "emoji"`).run();
}
