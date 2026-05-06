import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    console.log("Starting migration: Add shoppingQty and shoppingUnitId to RecipeIngredient...");

    db.exec(`
        ALTER TABLE "RecipeIngredient" ADD COLUMN "shoppingQty" REAL;
        ALTER TABLE "RecipeIngredient" ADD COLUMN "shoppingUnitId" TEXT REFERENCES "QuantityUnit" ("id") ON DELETE SET NULL;
    `);

    console.log("Migration complete: shoppingQty and shoppingUnitId added to RecipeIngredient.");
}

export function down(db: Database): void {
    db.prepare(`ALTER TABLE "RecipeIngredient" DROP COLUMN "shoppingQty"`).run();
    db.prepare(`ALTER TABLE "RecipeIngredient" DROP COLUMN "shoppingUnitId"`).run();
}
