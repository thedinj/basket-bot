import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    console.log("Starting migration: Rename RecipeTag.color to colorKey (palette key)...");

    db.exec(`
        CREATE TABLE "RecipeTag_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "name" TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 50),
            "colorKey" TEXT CHECK("colorKey" IS NULL OR length("colorKey") <= 30),
            "createdById" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT,
            UNIQUE("householdId", "name" COLLATE NOCASE)
        );

        INSERT INTO "RecipeTag_new" (id, householdId, name, colorKey, createdById, createdAt)
        SELECT id, householdId, name, NULL, createdById, createdAt
        FROM "RecipeTag";

        DROP TABLE "RecipeTag";

        ALTER TABLE "RecipeTag_new" RENAME TO "RecipeTag";
    `);

    db.exec(`
        ALTER TABLE "Recipe" ADD COLUMN "cookingTimeMinutes" INTEGER;
        ALTER TABLE "Recipe" ADD COLUMN "isPoolExcluded" INTEGER;
        ALTER TABLE "PlanSlot" ADD COLUMN "maxCookingTimeMinutes" INTEGER;
    `);

    console.log(
        "Migration complete: RecipeTag.color renamed to colorKey, cookingTimeMinutes, isPoolExcluded, and maxCookingTimeMinutes added."
    );
}

export function down(db: Database): void {
    db.exec(`
        CREATE TABLE "RecipeTag_old" (
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

        INSERT INTO "RecipeTag_old" (id, householdId, name, color, createdById, createdAt)
        SELECT id, householdId, name, colorKey, createdById, createdAt
        FROM "RecipeTag";

        DROP TABLE "RecipeTag";

        ALTER TABLE "RecipeTag_old" RENAME TO "RecipeTag";
    `);

    db.prepare(`ALTER TABLE "Recipe" DROP COLUMN "cookingTimeMinutes"`).run();
    const hasPoolExcluded = (
        db.prepare(`PRAGMA table_info(Recipe)`).all() as Array<{ name: string }>
    ).some((col) => col.name === "isPoolExcluded");
    if (hasPoolExcluded) {
        db.prepare(`ALTER TABLE "Recipe" DROP COLUMN "isPoolExcluded"`).run();
    }
    db.prepare(`ALTER TABLE "PlanSlot" DROP COLUMN "maxCookingTimeMinutes"`).run();
}
