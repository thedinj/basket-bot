import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        ALTER TABLE "PlanIngredientRoute" ADD COLUMN "isUnsure" INTEGER;
    `);
}

export function down(db: Database): void {
    db.prepare(`ALTER TABLE "PlanIngredientRoute" DROP COLUMN "isUnsure"`).run();
}
