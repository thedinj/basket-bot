import type { Database } from "better-sqlite3";

/**
 * Migration: Add per-user store ordering
 *
 * Adds the UserStoreOrder junction table so each user can define their own order
 * for the store tabs on the shopping list. Ordering is per-user because a store may
 * be shared across users (via household membership), so it cannot live on the Store row.
 */

export function up(db: Database): void {
    console.log("Starting migration: Add per-user store ordering...");

    db.exec(`
        CREATE TABLE IF NOT EXISTS "UserStoreOrder" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "storeId" TEXT NOT NULL,
            "sortOrder" INTEGER NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            UNIQUE ("userId", "storeId")
        );

        CREATE INDEX IF NOT EXISTS "UserStoreOrder_userId_idx"
            ON "UserStoreOrder"("userId");
    `);

    console.log("  ✓ Created UserStoreOrder table and index");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Add per-user store ordering...");

    db.exec(`
        DROP INDEX IF EXISTS "UserStoreOrder_userId_idx";
        DROP TABLE IF EXISTS "UserStoreOrder";
    `);

    console.log("  ✓ Dropped UserStoreOrder table and index");
}
