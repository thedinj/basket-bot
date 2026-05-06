import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    console.log("Starting migration: Add shoppingName to RecipeIngredient...");

    db.exec(
        `ALTER TABLE "RecipeIngredient" ADD COLUMN "shoppingName" TEXT CHECK("shoppingName" IS NULL OR length("shoppingName") <= 255);`
    );

    console.log("Migration complete: shoppingName added to RecipeIngredient.");
}

export function down(db: Database): void {
    db.prepare(`ALTER TABLE "RecipeIngredient" DROP COLUMN "shoppingName"`).run();
}
