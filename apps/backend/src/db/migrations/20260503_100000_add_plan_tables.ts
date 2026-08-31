import type { Database } from "better-sqlite3";

/**
 * Migration: Add Plan Tables + excluded column on RecipeIngredient
 *
 * Adds the meal planning wizard data model:
 *
 * Plan         — a household-scoped plan record (draft → active → archived)
 * PlanSlot     — one slot per meal in the plan, with tag-based intent and a picked recipe
 * PlanIngredientRoute — maps each plan ingredient to a store for routing
 *
 * Also adds RecipeIngredient.excluded: when 1, the ingredient is skipped when dispatching
 * a meal plan to the shopping list (pantry staples like butter, olive oil, etc.).
 *
 * Design decisions:
 * - Plan is household-scoped (not user-scoped) so all members see the same plan
 * - tagIds stored as JSON array in PlanSlot (avoids a junction table for a transient wizard)
 * - ingredientId is a FK to RecipeIngredient (store-agnostic; qty/unit come from the ingredient)
 * - storeId NULL in PlanIngredientRoute means "unrouted" (distinct from a missing store)
 * - Boolean storage: NULL = false, 1 = true (following app convention)
 */
export function up(db: Database): void {
    console.log("Starting migration: Add plan tables + RecipeIngredient.excluded...");

    db.exec(`
        -- Plan table
        CREATE TABLE IF NOT EXISTS "Plan" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "state" TEXT NOT NULL DEFAULT 'draft' CHECK("state" IN ('draft', 'active', 'archived')),
            "slotCount" INTEGER NOT NULL DEFAULT 4 CHECK("slotCount" >= 1 AND "slotCount" <= 12),
            "defaultStoreId" TEXT,
            "dispatchedAt" DATETIME,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("defaultStoreId") REFERENCES "Store" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- PlanSlot table — one row per meal slot in a plan
        CREATE TABLE IF NOT EXISTS "PlanSlot" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "planId" TEXT NOT NULL,
            "slotNumber" INTEGER NOT NULL CHECK("slotNumber" >= 1),
            "tagIds" TEXT NOT NULL DEFAULT '[]',
            "pickedRecipeId" TEXT,
            "pinned" INTEGER,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("pickedRecipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL,
            UNIQUE ("planId", "slotNumber")
        );

        -- PlanIngredientRoute table — ingredient → store routing for step 3
        CREATE TABLE IF NOT EXISTS "PlanIngredientRoute" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "planId" TEXT NOT NULL,
            "ingredientId" TEXT NOT NULL,
            "storeId" TEXT,
            "overridden" INTEGER,
            "checked" INTEGER,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("ingredientId") REFERENCES "RecipeIngredient" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL,
            UNIQUE ("planId", "ingredientId")
        );

        CREATE INDEX "Plan_householdId_state_createdAt_idx"
            ON "Plan"("householdId", "state", "createdAt" DESC);

        CREATE INDEX "PlanSlot_planId_slotNumber_idx"
            ON "PlanSlot"("planId", "slotNumber");

        CREATE INDEX "PlanIngredientRoute_planId_idx"
            ON "PlanIngredientRoute"("planId");

        ALTER TABLE "RecipeIngredient" ADD COLUMN "excluded" INTEGER;
    `);

    console.log("  ✓ Created Plan table");
    console.log("  ✓ Created PlanSlot table");
    console.log("  ✓ Created PlanIngredientRoute table");
    console.log("  ✓ Created indexes");
    console.log("  ✓ Added excluded column to RecipeIngredient");
    console.log("Migration complete");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Remove plan tables + RecipeIngredient.excluded...");

    // SQLite does not support DROP COLUMN in older versions, so recreate RecipeIngredient
    db.exec(`
        DROP TABLE IF EXISTS "PlanIngredientRoute";
        DROP TABLE IF EXISTS "PlanSlot";
        DROP TABLE IF EXISTS "Plan";

        CREATE TABLE "RecipeIngredient_backup" AS SELECT
            id, recipeId, name, qty, unitId, sortOrder, notes,
            createdById, updatedById, createdAt, updatedAt
        FROM "RecipeIngredient";

        DROP TABLE "RecipeIngredient";

        ALTER TABLE "RecipeIngredient_backup" RENAME TO "RecipeIngredient";
    `);

    console.log("  ✓ Removed PlanIngredientRoute table");
    console.log("  ✓ Removed PlanSlot table");
    console.log("  ✓ Removed Plan table");
    console.log("  ✓ Removed excluded column from RecipeIngredient");
    console.log("Rollback complete");
}
