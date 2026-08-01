import type { Database } from "better-sqlite3";

/**
 * Migration: Add ErrorLog table
 *
 * Persists server-side errors (requestId, route, status, code, message, stack)
 * so admins can review recent failures instead of only relying on stdout logs.
 */

export function up(db: Database): void {
    console.log("Starting migration: Add ErrorLog table...");

    db.exec(`
        CREATE TABLE IF NOT EXISTS "ErrorLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "requestId" TEXT NOT NULL CHECK(length("requestId") <= 100),
            "userId" TEXT,
            "route" TEXT NOT NULL CHECK(length("route") <= 255),
            "method" TEXT NOT NULL CHECK(length("method") <= 10),
            "statusCode" INTEGER NOT NULL,
            "code" TEXT NOT NULL CHECK(length("code") <= 100),
            "message" TEXT NOT NULL CHECK(length("message") <= 1000),
            "stack" TEXT CHECK("stack" IS NULL OR length("stack") <= 4000),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt" DESC);
        CREATE INDEX IF NOT EXISTS "ErrorLog_requestId_idx" ON "ErrorLog"("requestId");
    `);

    console.log("  ✓ Created ErrorLog table");
    console.log("Migration complete: ErrorLog enabled");
}

export function down(db: Database): void {
    console.log("Rolling back migration: Remove ErrorLog table...");

    db.exec(`
        DROP TABLE IF EXISTS "ErrorLog";
    `);
}
