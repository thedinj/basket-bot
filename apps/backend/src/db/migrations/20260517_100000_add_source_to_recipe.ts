import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        ALTER TABLE "Recipe" ADD COLUMN "source" TEXT
            CHECK("source" IS NULL OR (length("source") >= 1 AND length("source") <= 200));
    `);
}

export function down(db: Database): void {
    db.prepare(`ALTER TABLE "Recipe" DROP COLUMN "source"`).run();
}
