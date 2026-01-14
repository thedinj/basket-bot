import Database from "better-sqlite3";
import * as path from "path";

const globalForDb = globalThis as unknown as {
    db: Database.Database | undefined;
};

// Get database path from environment or use default
const dbPath = process.env.DATABASE_URL?.replace("file:", "") || path.join(process.cwd(), "dev.db");

export const db =
    globalForDb.db ??
    new Database(dbPath, {
        verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
    });

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Cache the database instance in development
if (process.env.NODE_ENV !== "production") {
    globalForDb.db = db;
}

// Graceful shutdown
process.on("beforeExit", () => {
    db.close();
});
