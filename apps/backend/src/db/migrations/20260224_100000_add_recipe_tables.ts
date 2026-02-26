import type { Database } from "better-sqlite3";

/**
 * Migration: Add Recipe Management Tables
 *
 * This migration adds recipe management capabilities with a normalized tag system.
 *
 * Tables created:
 * 1. Recipe - Core recipe entity with markdown steps
 * 2. RecipeTag - Normalized tags for categorizing recipes (household-scoped)
 * 3. RecipeTagAssignment - Many-to-many junction table for recipe tags
 * 4. RecipeIngredient - Recipe ingredients with optional quantities and units
 *
 * Design decisions:
 * - Household-owned entities (recipes belong to household context)
 * - Store-agnostic ingredients (no FK to StoreItem - keeps recipes flexible)
 * - Normalized tags with junction table for efficient filtering
 * - Boolean storage: NULL = false, 1 = true (following app convention)
 * - Cascade deletes: deleting recipe removes ingredients and tag assignments
 */

export function up(db: Database): void {
    console.log("Starting migration: Add recipe management tables...");

    db.exec(`
        -- Recipe table
        CREATE TABLE IF NOT EXISTS "Recipe" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200),
            "description" TEXT CHECK("description" IS NULL OR length("description") <= 2000),
            "steps" TEXT CHECK("steps" IS NULL OR length("steps") <= 50000),
            "sourceUrl" TEXT CHECK("sourceUrl" IS NULL OR length("sourceUrl") <= 500),
            "isHidden" INTEGER,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- RecipeTag table
        CREATE TABLE IF NOT EXISTS "RecipeTag" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 50),
            "color" TEXT CHECK("color" IS NULL OR length("color") <= 255),
            "createdById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE("householdId", "name" COLLATE NOCASE)
        );

        -- RecipeTagAssignment junction table
        CREATE TABLE IF NOT EXISTS "RecipeTagAssignment" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "recipeId" TEXT NOT NULL,
            "tagId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("tagId") REFERENCES "RecipeTag" ("id") ON DELETE CASCADE,
            UNIQUE("recipeId", "tagId")
        );

        -- RecipeIngredient table
        CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "recipeId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200),
            "qty" REAL,
            "unitId" TEXT,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "notes" TEXT CHECK("notes" IS NULL OR length("notes") <= 500),
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("unitId") REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- Indexes for Recipe
        CREATE INDEX "Recipe_householdId_isHidden_name_idx" ON "Recipe"("householdId", "isHidden", "name");

        -- Indexes for RecipeTag
        CREATE INDEX "RecipeTag_householdId_name_idx" ON "RecipeTag"("householdId", "name");

        -- Indexes for RecipeTagAssignment
        CREATE INDEX "RecipeTagAssignment_recipeId_idx" ON "RecipeTagAssignment"("recipeId");
        CREATE INDEX "RecipeTagAssignment_tagId_idx" ON "RecipeTagAssignment"("tagId");

        -- Indexes for RecipeIngredient
        CREATE INDEX "RecipeIngredient_recipeId_sortOrder_idx" ON "RecipeIngredient"("recipeId", "sortOrder");
    `);

    console.log("  ✓ Created Recipe table");
    console.log("  ✓ Created RecipeTag table");
    console.log("  ✓ Created RecipeTagAssignment junction table");
    console.log("  ✓ Created RecipeIngredient table");
    console.log("  ✓ Created all indexes");
    console.log("Migration complete: Recipe management enabled");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Remove recipe management tables...");

    db.exec(`
        -- Drop tables in reverse order to respect foreign keys
        DROP TABLE IF EXISTS "RecipeIngredient";
        DROP TABLE IF EXISTS "RecipeTagAssignment";
        DROP TABLE IF EXISTS "RecipeTag";
        DROP TABLE IF EXISTS "Recipe";
    `);

    console.log("  ✓ Removed RecipeIngredient table");
    console.log("  ✓ Removed RecipeTagAssignment table");
    console.log("  ✓ Removed RecipeTag table");
    console.log("  ✓ Removed Recipe table");
    console.log("Rollback complete: Recipe management disabled");
}
