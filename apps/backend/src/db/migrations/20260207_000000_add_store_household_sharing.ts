import type { Database } from "better-sqlite3";

/**
 * Migration: Add household sharing to stores and remove email-based collaboration
 *
 * This migration transitions stores from email-based collaboration (StoreCollaborator/StoreInvitation)
 * to household-based sharing. Stores can now optionally be shared with a household, where all
 * household members have access based on their household role.
 *
 * Changes:
 * 1. Add householdId column to Store table (nullable, foreign key to Household)
 * 2. Drop StoreCollaborator table (email-based collaboration)
 * 3. Drop StoreInvitation table (pending email invitations)
 * 4. All existing stores become private (householdId = NULL)
 *
 * Note: Existing store collaborations are NOT preserved (only 2 production users,
 * trivial to manually reshare via households if needed).
 */

export function up(db: Database): void {
    console.log("Starting migration: Add household sharing to stores...");

    // Drop StoreInvitation and StoreCollaborator tables first
    // (they have foreign keys to Store, must drop before modifying Store table structure)
    db.exec(`
		DROP TABLE IF EXISTS "StoreInvitation";
		DROP TABLE IF EXISTS "StoreCollaborator";
	`);

    console.log("  ✓ Dropped StoreCollaborator and StoreInvitation tables");

    // Recreate Store table with householdId column
    // SQLite doesn't support ALTER TABLE ADD COLUMN with FOREIGN KEY,
    // so we must recreate the table
    db.exec(`
		CREATE TABLE "Store_new" (
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

		-- Copy existing stores (all become private with householdId = NULL)
		INSERT INTO "Store_new" ("id", "name", "householdId", "createdById", "updatedById", "createdAt", "updatedAt")
		SELECT "id", "name", NULL, "createdById", "updatedById", "createdAt", "updatedAt"
		FROM "Store";

		DROP TABLE "Store";
		ALTER TABLE "Store_new" RENAME TO "Store";

		-- Recreate index for householdId
		CREATE INDEX IF NOT EXISTS "Store_householdId_idx" ON "Store"("householdId");
	`);

    console.log("  ✓ Added householdId column to Store table");
    console.log("  ✓ All existing stores set to private (householdId = NULL)");
    console.log("Migration complete: Store household sharing enabled");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Remove household sharing from stores...");

    // Recreate Store table without householdId
    db.exec(`
		CREATE TABLE "Store_old" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
			"createdById" TEXT NOT NULL,
			"updatedById" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL,
			FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
		);

		INSERT INTO "Store_old" ("id", "name", "createdById", "updatedById", "createdAt", "updatedAt")
		SELECT "id", "name", "createdById", "updatedById", "createdAt", "updatedAt"
		FROM "Store";

		DROP TABLE "Store";
		ALTER TABLE "Store_old" RENAME TO "Store";
	`);

    // Recreate StoreCollaborator table
    db.exec(`
		CREATE TABLE IF NOT EXISTS "StoreCollaborator" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"storeId" TEXT NOT NULL,
			"userId" TEXT NOT NULL,
			"role" TEXT NOT NULL CHECK(length("role") <= 50),
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
			UNIQUE ("storeId", "userId")
		);
	`);

    // Recreate StoreInvitation table
    db.exec(`
		CREATE TABLE IF NOT EXISTS "StoreInvitation" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"storeId" TEXT NOT NULL,
			"invitedEmail" TEXT NOT NULL COLLATE NOCASE CHECK(length("invitedEmail") <= 255),
			"invitedById" TEXT NOT NULL,
			"role" TEXT NOT NULL CHECK(length("role") <= 50),
			"token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255),
			"status" TEXT NOT NULL DEFAULT 'pending' CHECK(length("status") <= 50),
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS "StoreInvitation_token_idx" ON "StoreInvitation"("token");
		CREATE INDEX IF NOT EXISTS "StoreInvitation_invitedEmail_status_idx"
			ON "StoreInvitation"("invitedEmail", "status");
	`);

    console.log("  ✓ Removed householdId from Store table");
    console.log("  ✓ Recreated StoreCollaborator and StoreInvitation tables");
    console.log("Rollback complete: Email collaboration restored");
}
