import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        UPDATE "QuantityUnit" SET "sortOrder" = 24 WHERE "id" = 'cup';
        UPDATE "QuantityUnit" SET "sortOrder" = 25 WHERE "id" = 'gallon';
        UPDATE "QuantityUnit" SET "sortOrder" = 26 WHERE "id" = 'tablespoon';
        UPDATE "QuantityUnit" SET "sortOrder" = 27 WHERE "id" = 'teaspoon';
    `);
    db.prepare(
        `INSERT OR IGNORE INTO "QuantityUnit" ("id", "name", "abbreviation", "sortOrder", "category")
         VALUES ('quart', 'Quart', 'qt', 23, 'volume')`
    ).run();
}

export function down(db: Database): void {
    db.exec(`
        DELETE FROM "QuantityUnit" WHERE "id" = 'quart';
        UPDATE "QuantityUnit" SET "sortOrder" = 24 WHERE "id" = 'gallon';
        UPDATE "QuantityUnit" SET "sortOrder" = 23 WHERE "id" = 'cup';
        UPDATE "QuantityUnit" SET "sortOrder" = 25 WHERE "id" = 'tablespoon';
        UPDATE "QuantityUnit" SET "sortOrder" = 26 WHERE "id" = 'teaspoon';
    `);
}
