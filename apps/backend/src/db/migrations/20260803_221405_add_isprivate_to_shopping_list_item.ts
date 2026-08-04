import type { Database } from "better-sqlite3";

/**
 * Migration: Add isPrivate flag to shopping list items
 *
 * This migration adds an optional isPrivate boolean flag to ShoppingListItem, allowing a user
 * to add an item to a shared store's shopping list that only they (the creator) can see,
 * check off, or delete — hidden from other collaborators on that store.
 *
 * Changes:
 * 1. Add isPrivate INTEGER column to ShoppingListItem table (NULL = false, 1 = true)
 * 2. All existing shopping list items default to visible (isPrivate = NULL)
 *
 * Note: Uses INTEGER for boolean storage following SQLite conventions (NULL = false, 1 = true).
 * Repository layer converts between boolean and integer using boolToInt/intToBool helpers.
 */

export function up(db: Database): void {
    console.log("Starting migration: Add isPrivate flag to ShoppingListItem...");

    // Recreate ShoppingListItem table with isPrivate column
    // SQLite doesn't support ALTER TABLE ADD COLUMN with all constraints we need,
    // so we must recreate the table
    db.exec(`
		CREATE TABLE "ShoppingListItem_new" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"storeId" TEXT NOT NULL,
			"storeItemId" TEXT,
			"qty" REAL,
			"unitId" TEXT,
			"notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 1000),
			"isChecked" BOOLEAN,
			"checkedAt" DATETIME,
			"checkedBy" TEXT,
			"checkedUpdatedAt" DATETIME,
			"isSample" BOOLEAN,
			"isUnsure" BOOLEAN,
			"isIdea" BOOLEAN,
			"snoozedUntil" DATETIME,
			"isPrivate" INTEGER,
			"createdById" TEXT NOT NULL,
			"updatedById" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL,
			FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("storeItemId") REFERENCES "StoreItem" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("checkedBy") REFERENCES "User" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
		);

		-- Copy existing shopping list items (all default to visible with isPrivate = NULL)
		INSERT INTO "ShoppingListItem_new" (
			"id", "storeId", "storeItemId", "qty", "unitId", "notes",
			"isChecked", "checkedAt", "checkedBy", "checkedUpdatedAt",
			"isSample", "isUnsure", "isIdea", "snoozedUntil", "isPrivate",
			"createdById", "updatedById", "createdAt", "updatedAt"
		)
		SELECT
			"id", "storeId", "storeItemId", "qty", "unitId", "notes",
			"isChecked", "checkedAt", "checkedBy", "checkedUpdatedAt",
			"isSample", "isUnsure", "isIdea", "snoozedUntil", NULL,
			"createdById", "updatedById", "createdAt", "updatedAt"
		FROM "ShoppingListItem";

		DROP TABLE "ShoppingListItem";
		ALTER TABLE "ShoppingListItem_new" RENAME TO "ShoppingListItem";

		-- Recreate index
		CREATE INDEX IF NOT EXISTS "ShoppingListItem_storeId_isChecked_updatedAt_idx"
			ON "ShoppingListItem"("storeId", "isChecked", "updatedAt");
	`);

    console.log("  ✓ Added isPrivate column to ShoppingListItem table");
    console.log("  ✓ All existing shopping list items set to visible (isPrivate = NULL)");
    console.log("Migration complete: Private shopping list items enabled");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Remove isPrivate flag from ShoppingListItem...");

    db.exec(`
		CREATE TABLE "ShoppingListItem_old" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"storeId" TEXT NOT NULL,
			"storeItemId" TEXT,
			"qty" REAL,
			"unitId" TEXT,
			"notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 1000),
			"isChecked" BOOLEAN,
			"checkedAt" DATETIME,
			"checkedBy" TEXT,
			"checkedUpdatedAt" DATETIME,
			"isSample" BOOLEAN,
			"isUnsure" BOOLEAN,
			"isIdea" BOOLEAN,
			"snoozedUntil" DATETIME,
			"createdById" TEXT NOT NULL,
			"updatedById" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL,
			FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("storeItemId") REFERENCES "StoreItem" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("checkedBy") REFERENCES "User" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
		);

		INSERT INTO "ShoppingListItem_old" (
			"id", "storeId", "storeItemId", "qty", "unitId", "notes",
			"isChecked", "checkedAt", "checkedBy", "checkedUpdatedAt",
			"isSample", "isUnsure", "isIdea", "snoozedUntil",
			"createdById", "updatedById", "createdAt", "updatedAt"
		)
		SELECT
			"id", "storeId", "storeItemId", "qty", "unitId", "notes",
			"isChecked", "checkedAt", "checkedBy", "checkedUpdatedAt",
			"isSample", "isUnsure", "isIdea", "snoozedUntil",
			"createdById", "updatedById", "createdAt", "updatedAt"
		FROM "ShoppingListItem";

		DROP TABLE "ShoppingListItem";
		ALTER TABLE "ShoppingListItem_old" RENAME TO "ShoppingListItem";

		CREATE INDEX IF NOT EXISTS "ShoppingListItem_storeId_isChecked_updatedAt_idx"
			ON "ShoppingListItem"("storeId", "isChecked", "updatedAt");
	`);

    console.log("  ✓ Removed isPrivate column from ShoppingListItem table");
    console.log("Rollback complete: Private shopping list items disabled");
}
