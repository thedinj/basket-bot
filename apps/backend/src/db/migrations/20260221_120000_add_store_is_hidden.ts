import type { Database } from "better-sqlite3";

/**
 * Migration: Add isHidden flag to stores
 *
 * This migration adds an optional isHidden boolean flag to stores, allowing users to hide
 * stores from dropdowns (e.g., vacation stores that are only needed occasionally).
 *
 * Changes:
 * 1. Add isHidden INTEGER column to Store table (NULL = false, 1 = true)
 * 2. All existing stores default to visible (isHidden = NULL)
 *
 * Note: Uses INTEGER for boolean storage following SQLite conventions (NULL = false, 1 = true).
 * Repository layer converts between boolean and integer using boolToInt/intToBool helpers.
 */

export function up(db: Database): void {
    console.log("Starting migration: Add isHidden flag to stores...");

    // Recreate Store table with isHidden column
    // SQLite doesn't support ALTER TABLE ADD COLUMN with all constraints we need,
    // so we must recreate the table
    db.exec(`
		CREATE TABLE "Store_new" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
			"householdId" TEXT,
			"isHidden" INTEGER,
			"createdById" TEXT NOT NULL,
			"updatedById" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL,
			FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
		);

		-- Copy existing stores (all default to visible with isHidden = NULL)
		INSERT INTO "Store_new" ("id", "name", "householdId", "isHidden", "createdById", "updatedById", "createdAt", "updatedAt")
		SELECT "id", "name", "householdId", NULL, "createdById", "updatedById", "createdAt", "updatedAt"
		FROM "Store";

		DROP TABLE "Store";
		ALTER TABLE "Store_new" RENAME TO "Store";

		-- Recreate index for householdId
		CREATE INDEX IF NOT EXISTS "Store_householdId_idx" ON "Store"("householdId");
	`);

    console.log("  ✓ Added isHidden column to Store table");
    console.log("  ✓ All existing stores set to visible (isHidden = NULL)");
    console.log("Migration complete: Store hiding enabled");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Remove isHidden flag from stores...");

    // Recreate Store table without isHidden
    db.exec(`
		CREATE TABLE "Store_old" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
			"householdId" TEXT,
			"createdById" TEXT NOT NULL,
			"updatedById" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL,
			FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
		);

		INSERT INTO "Store_old" ("id", "name", "householdId", "createdById", "updatedById", "createdAt", "updatedAt")
		SELECT "id", "name", "householdId", "createdById", "updatedById", "createdAt", "updatedAt"
		FROM "Store";

		DROP TABLE "Store";
		ALTER TABLE "Store_old" RENAME TO "Store";

		-- Recreate index for householdId
		CREATE INDEX IF NOT EXISTS "Store_householdId_idx" ON "Store"("householdId");
	`);

    console.log("  ✓ Removed isHidden column from Store table");
    console.log("Rollback complete: Store hiding disabled");
}
