import type { Database } from "better-sqlite3";

/**
 * Migration: Add checkedBy and checkedUpdatedAt columns to ShoppingListItem
 *
 * These columns track which user checked/unchecked an item and when,
 * separate from the general updatedById/updatedAt audit fields.
 */

export function up(db: Database): void {
    db.exec(`
        -- Add checkedBy column (nullable, foreign key to User)
        ALTER TABLE "ShoppingListItem" ADD COLUMN "checkedBy" TEXT;

        -- Add checkedUpdatedAt column (nullable, tracks when check status changed)
        ALTER TABLE "ShoppingListItem" ADD COLUMN "checkedUpdatedAt" DATETIME;

        -- Add foreign key constraint (SQLite doesn't support adding FK via ALTER,
        -- but we document it here and enforce at application level)
        -- FOREIGN KEY ("checkedBy") REFERENCES "User" ("id") ON DELETE SET NULL
    `);

    console.log("  ✓ Added checkedBy and checkedUpdatedAt columns to ShoppingListItem");
}

export function down(db: Database): void {
    // SQLite doesn't support DROP COLUMN before version 3.35.0 (2021-03-12)
    // For older SQLite versions, we'd need to recreate the table
    // For now, we'll use the simpler approach and require SQLite 3.35.0+

    db.exec(`
        ALTER TABLE "ShoppingListItem" DROP COLUMN "checkedBy";
        ALTER TABLE "ShoppingListItem" DROP COLUMN "checkedUpdatedAt";
    `);

    console.log("  ✓ Removed checkedBy and checkedUpdatedAt columns from ShoppingListItem");
}
