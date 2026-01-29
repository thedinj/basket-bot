import { db } from "../lib/db/db";

/**
 * Initialize the database schema
 */
export function initializeDatabase() {
    // Create all tables
    db.exec(`
        -- User table
        CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "email" TEXT NOT NULL UNIQUE,
            "name" TEXT NOT NULL,
            "password" TEXT NOT NULL,
            "scopes" TEXT NOT NULL DEFAULT '',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        );

        -- Household table
        CREATE TABLE IF NOT EXISTS "Household" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- HouseholdMember table
        CREATE TABLE IF NOT EXISTS "HouseholdMember" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
            UNIQUE ("householdId", "userId")
        );

        -- HouseholdInvitation table
        CREATE TABLE IF NOT EXISTS "HouseholdInvitation" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "invitedEmail" TEXT NOT NULL COLLATE NOCASE,
            "invitedById" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        -- AppSetting table
        CREATE TABLE IF NOT EXISTS "AppSetting" (
            "key" TEXT NOT NULL PRIMARY KEY,
            "value" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- QuantityUnit table
        CREATE TABLE IF NOT EXISTS "QuantityUnit" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "abbreviation" TEXT NOT NULL,
            "sortOrder" INTEGER NOT NULL,
            "category" TEXT NOT NULL
        );

        -- Store table
        CREATE TABLE IF NOT EXISTS "Store" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- StoreCollaborator table
        CREATE TABLE IF NOT EXISTS "StoreCollaborator" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
            UNIQUE ("storeId", "userId")
        );

        -- StoreInvitation table
        CREATE TABLE IF NOT EXISTS "StoreInvitation" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "invitedEmail" TEXT NOT NULL COLLATE NOCASE,
            "invitedById" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        -- StoreAisle table
        CREATE TABLE IF NOT EXISTS "StoreAisle" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- StoreSection table
        CREATE TABLE IF NOT EXISTS "StoreSection" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "aisleId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- StoreItem table
        CREATE TABLE IF NOT EXISTS "StoreItem" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "nameNorm" TEXT NOT NULL,
            "aisleId" TEXT,
            "sectionId" TEXT,
            "usageCount" INTEGER NOT NULL DEFAULT 0,
            "lastUsedAt" DATETIME,
            "isHidden" BOOLEAN NOT NULL DEFAULT 0,
            "isFavorite" BOOLEAN NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("sectionId") REFERENCES "StoreSection" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE ("storeId", "nameNorm")
        );

        -- ShoppingListItem table
        CREATE TABLE IF NOT EXISTS "ShoppingListItem" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "storeItemId" TEXT,
            "qty" REAL,
            "unitId" TEXT,
            "notes" TEXT,
            "isChecked" BOOLEAN,
            "checkedAt" DATETIME,
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
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        -- RefreshToken table
        CREATE TABLE IF NOT EXISTS "RefreshToken" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE,
            "expiresAt" DATETIME NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS "ShoppingListItem_storeId_isChecked_updatedAt_idx"
            ON "ShoppingListItem"("storeId", "isChecked", "updatedAt");

        CREATE INDEX IF NOT EXISTS "HouseholdInvitation_token_idx"
            ON "HouseholdInvitation"("token");

        CREATE INDEX IF NOT EXISTS "HouseholdInvitation_invitedEmail_status_idx"
            ON "HouseholdInvitation"("invitedEmail", "status");

        CREATE INDEX IF NOT EXISTS "StoreInvitation_token_idx"
            ON "StoreInvitation"("token");

        CREATE INDEX IF NOT EXISTS "StoreInvitation_invitedEmail_status_idx"
            ON "StoreInvitation"("invitedEmail", "status");

        CREATE INDEX IF NOT EXISTS "User_email_idx"
            ON "User"("email" COLLATE NOCASE);

        -- Insert quantity units if not exists
        INSERT OR IGNORE INTO "QuantityUnit" ("id", "name", "abbreviation", "sortOrder", "category") VALUES
        ('gram', 'Gram', 'g', 10, 'weight'),
        ('kilogram', 'Kilogram', 'kg', 11, 'weight'),
        ('milligram', 'Milligram', 'mg', 9, 'weight'),
        ('ounce', 'Ounce', 'oz', 12, 'weight'),
        ('pound', 'Pound', 'lb', 13, 'weight'),
        ('milliliter', 'Milliliter', 'ml', 20, 'volume'),
        ('liter', 'Liter', 'l', 21, 'volume'),
        ('fluid-ounce', 'Fluid Ounce', 'fl oz', 22, 'volume'),
        ('gallon', 'Gallon', 'gal', 23, 'volume'),
        ('cup', 'Cup', 'cup', 24, 'volume'),
        ('tablespoon', 'Tablespoon', 'tbsp', 25, 'volume'),
        ('teaspoon', 'Teaspoon', 'tsp', 26, 'volume'),
        ('count', 'Count', 'ct', 30, 'count'),
        ('dozen', 'Dozen', 'doz', 31, 'count'),
        ('package', 'Package', 'pkg', 40, 'package'),
        ('can', 'Can', 'can', 41, 'package'),
        ('box', 'Box', 'box', 42, 'package'),
        ('bag', 'Bag', 'bag', 43, 'package'),
        ('bottle', 'Bottle', 'btl', 44, 'package'),
        ('jar', 'Jar', 'jar', 45, 'package'),
        ('bunch', 'Bunch', 'bunch', 50, 'other');
    `);

    console.log("Database initialized successfully");
}
