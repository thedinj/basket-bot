import type { Database } from "better-sqlite3";

/**
 * Migration: Add nameNorm + uniqueness constraints to StoreAisle and StoreSection
 *
 * StoreItem already enforces UNIQUE(storeId, nameNorm), but StoreAisle and StoreSection
 * had no equivalent protection, allowing duplicate aisle/section names (e.g. two "Spices"
 * sections under the same aisle, one differing only by a stray whitespace character).
 *
 * Aisle names are unique per store; section names are unique per aisle (two different
 * aisles may each have their own section with the same name).
 *
 * Because existing databases may already contain duplicate names that would violate the
 * new UNIQUE constraint, this migration first disambiguates any pre-existing duplicates by
 * appending a " (2)", " (3)", ... suffix to all but the earliest-created row in each
 * colliding group, logging each rename via console.warn for manual follow-up. This is the
 * minimum disambiguation needed to add the constraint safely -- it is not a general
 * duplicate-data cleanup feature.
 *
 * The normalization logic mirrors normalizeItemName in lib/utils/stringUtils.ts. It is
 * duplicated here (not imported) because migrations must stay self-contained and unaffected
 * by later changes to application code.
 */

function normalizeForMigration(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

interface AisleRow {
    id: string;
    storeId: string;
    name: string;
    sortOrder: number;
    createdById: string;
    updatedById: string;
    createdAt: string;
    updatedAt: string;
}

interface SectionRow {
    id: string;
    storeId: string;
    aisleId: string;
    name: string;
    sortOrder: number;
    createdById: string;
    updatedById: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Groups rows by `groupKey`, keeps the earliest-created row in each group unchanged, and
 * renames the rest by appending a disambiguating " (n)" suffix so their normalized name
 * becomes unique. Mutates `row.name` in place and returns the rows in their original order.
 */
function disambiguateDuplicates<T extends { id: string; name: string; createdAt: string }>(
    rows: T[],
    groupKey: (row: T) => string,
    entityLabel: string
): T[] {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const key = groupKey(row);
        const existing = groups.get(key);
        if (existing) {
            existing.push(row);
        } else {
            groups.set(key, [row]);
        }
    }

    for (const group of groups.values()) {
        if (group.length <= 1) {
            continue;
        }

        group.sort((a, b) =>
            a.createdAt < b.createdAt
                ? -1
                : a.createdAt > b.createdAt
                  ? 1
                  : a.id.localeCompare(b.id)
        );

        for (let i = 1; i < group.length; i++) {
            const row = group[i];
            const originalName = row.name;
            const suffixedName = `${originalName} (${i + 1})`;
            row.name = suffixedName;
            console.warn(
                `Migration 20260719_000000: renamed duplicate ${entityLabel} "${originalName}" (id=${row.id}) to "${suffixedName}" to satisfy new uniqueness constraint`
            );
        }
    }

    return rows;
}

export function up(db: Database): void {
    console.log("Starting migration: Add nameNorm to StoreAisle and StoreSection...");

    const aisleRows = db.prepare(`SELECT * FROM "StoreAisle"`).all() as AisleRow[];
    disambiguateDuplicates(
        aisleRows,
        (row) => `${row.storeId}::${normalizeForMigration(row.name)}`,
        "aisle"
    );

    const sectionRows = db.prepare(`SELECT * FROM "StoreSection"`).all() as SectionRow[];
    disambiguateDuplicates(
        sectionRows,
        (row) => `${row.storeId}::${row.aisleId}::${normalizeForMigration(row.name)}`,
        "section"
    );

    db.exec(`
        CREATE TABLE "StoreAisle_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "nameNorm" TEXT NOT NULL CHECK(length("nameNorm") >= 1 AND length("nameNorm") <= 100),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE ("storeId", "nameNorm")
        );
    `);

    const insertAisle = db.prepare(`
        INSERT INTO "StoreAisle_new"
            ("id", "storeId", "name", "nameNorm", "sortOrder", "createdById", "updatedById", "createdAt", "updatedAt")
        VALUES (@id, @storeId, @name, @nameNorm, @sortOrder, @createdById, @updatedById, @createdAt, @updatedAt)
    `);
    for (const row of aisleRows) {
        insertAisle.run({ ...row, nameNorm: normalizeForMigration(row.name) });
    }

    db.exec(`
        DROP TABLE "StoreAisle";
        ALTER TABLE "StoreAisle_new" RENAME TO "StoreAisle";

        CREATE TABLE "StoreSection_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "aisleId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "nameNorm" TEXT NOT NULL CHECK(length("nameNorm") >= 1 AND length("nameNorm") <= 100),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("aisleId") REFERENCES "StoreAisle" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE ("storeId", "aisleId", "nameNorm")
        );
    `);

    const insertSection = db.prepare(`
        INSERT INTO "StoreSection_new"
            ("id", "storeId", "aisleId", "name", "nameNorm", "sortOrder", "createdById", "updatedById", "createdAt", "updatedAt")
        VALUES (@id, @storeId, @aisleId, @name, @nameNorm, @sortOrder, @createdById, @updatedById, @createdAt, @updatedAt)
    `);
    for (const row of sectionRows) {
        insertSection.run({ ...row, nameNorm: normalizeForMigration(row.name) });
    }

    db.exec(`
        DROP TABLE "StoreSection";
        ALTER TABLE "StoreSection_new" RENAME TO "StoreSection";
    `);

    console.log("  ✓ Added nameNorm + uniqueness constraints to StoreAisle and StoreSection");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Add nameNorm to StoreAisle and StoreSection...");

    db.exec(`
        CREATE TABLE "StoreAisle_old" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdById" TEXT NOT NULL,
            "updatedById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT
        );

        INSERT INTO "StoreAisle_old" ("id", "storeId", "name", "sortOrder", "createdById", "updatedById", "createdAt", "updatedAt")
        SELECT "id", "storeId", "name", "sortOrder", "createdById", "updatedById", "createdAt", "updatedAt" FROM "StoreAisle";

        DROP TABLE "StoreAisle";
        ALTER TABLE "StoreAisle_old" RENAME TO "StoreAisle";

        CREATE TABLE "StoreSection_old" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "storeId" TEXT NOT NULL,
            "aisleId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 100),
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

        INSERT INTO "StoreSection_old" ("id", "storeId", "aisleId", "name", "sortOrder", "createdById", "updatedById", "createdAt", "updatedAt")
        SELECT "id", "storeId", "aisleId", "name", "sortOrder", "createdById", "updatedById", "createdAt", "updatedAt" FROM "StoreSection";

        DROP TABLE "StoreSection";
        ALTER TABLE "StoreSection_old" RENAME TO "StoreSection";
    `);

    console.log("  ✓ Removed nameNorm + uniqueness constraints from StoreAisle and StoreSection");
    console.log("  Note: names auto-disambiguated during the up migration are not restored");
}
