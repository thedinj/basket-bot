import type { Database } from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { db } from "../lib/db/db";

interface Migration {
    filename: string;
    up: (db: Database) => void;
    down: (db: Database) => void;
}

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/**
 * The one migration that reconstructs the original schema rather than changing it. It is only
 * meaningful against an empty database; see `applicationTablesExist`.
 */
const BASELINE_MIGRATION = "00000000_000000_baseline.ts";

/**
 * True when the database already holds application data - i.e. it was created by
 * `initializeDatabase()` or by an earlier migration run, rather than being empty.
 */
function applicationTablesExist(): boolean {
    const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'`)
        .get();

    return !!row;
}

/**
 * Get all migration files sorted by timestamp
 */
function getMigrationFiles(): string[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return [];
    }

    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
        .sort(); // Timestamp prefix ensures correct ordering
}

/**
 * Create migrations tracking table if it doesn't exist
 */
function initMigrationsTable(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "_migrations" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "filename" TEXT NOT NULL UNIQUE,
            "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

/**
 * Get list of already applied migrations
 */
function getAppliedMigrations(): string[] {
    const rows = db.prepare(`SELECT filename FROM "_migrations" ORDER BY id ASC`).all() as {
        filename: string;
    }[];

    return rows.map((row) => row.filename);
}

/**
 * Record a migration as applied
 */
function recordMigration(filename: string): void {
    db.prepare(`INSERT INTO "_migrations" (filename) VALUES (?)`).run(filename);
}

/**
 * Record every known migration as applied without running any of them.
 *
 * `initializeDatabase()` builds the *current* schema directly, so a freshly initialised database
 * already reflects every migration ever written. Stamping them here is what stops `db:migrate`
 * from then trying to re-apply them - which used to fail immediately, because the first migration
 * adds a column `init.ts` already creates.
 */
export function markAllMigrationsApplied(): void {
    initMigrationsTable();

    const applied = new Set(getAppliedMigrations());
    const pending = getMigrationFiles().filter((file) => !applied.has(file));

    if (pending.length === 0) {
        return;
    }

    db.transaction(() => {
        for (const filename of pending) {
            recordMigration(filename);
        }
    })();

    console.log(`Marked ${pending.length} migration(s) as applied for the new schema`);
}

/**
 * Remove a migration record (for rollback)
 */
function unrecordMigration(filename: string): void {
    db.prepare(`DELETE FROM "_migrations" WHERE filename = ?`).run(filename);
}

/**
 * Load and execute pending migrations
 */
export async function runMigrations(): Promise<void> {
    console.log("Running database migrations...");

    initMigrationsTable();

    const allMigrations = getMigrationFiles();
    const appliedMigrations = getAppliedMigrations();
    const pendingMigrations = allMigrations.filter((file) => !appliedMigrations.includes(file));

    if (pendingMigrations.length === 0) {
        console.log("✓ No pending migrations");
        return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const filename of pendingMigrations) {
        // The baseline reconstructs the original schema, so running it against a database that
        // already has tables would be wrong - `CREATE TABLE IF NOT EXISTS` would silently
        // resurrect `StoreCollaborator` and `StoreInvitation`, which a later migration drops on
        // purpose. Record it and move on.
        if (filename === BASELINE_MIGRATION && applicationTablesExist()) {
            recordMigration(filename);
            console.log(`  - Skipped (database already exists): ${filename}`);
            continue;
        }

        console.log(`  Applying: ${filename}...`);

        const migrationPath = path.join(MIGRATIONS_DIR, filename);
        const migration = (await import(pathToFileURL(migrationPath).href)) as Migration;

        if (!migration.up) {
            throw new Error(`Migration ${filename} does not export an 'up' function`);
        }

        try {
            // Temporarily disable foreign keys for schema migrations that recreate tables
            // This is safe because the transaction will roll back on any error
            db.pragma("foreign_keys = OFF");

            // Run migration in a transaction
            db.transaction(() => {
                migration.up(db);
                recordMigration(filename);
            })();

            // Re-enable foreign keys
            db.pragma("foreign_keys = ON");

            console.log(`  ✓ Applied: ${filename}`);
        } catch (error) {
            console.error(`  ✗ Failed to apply migration ${filename}:`, error);
            throw error;
        }
    }

    console.log("✓ All migrations completed successfully");
}

/**
 * Rollback the last migration (development only)
 */
export async function rollbackLastMigration(): Promise<void> {
    console.log("Rolling back last migration...");

    initMigrationsTable();

    const appliedMigrations = getAppliedMigrations();

    if (appliedMigrations.length === 0) {
        console.log("No migrations to rollback");
        return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    console.log(`  Rolling back: ${lastMigration}...`);

    const migrationPath = path.join(MIGRATIONS_DIR, lastMigration);
    const migration = (await import(pathToFileURL(migrationPath).href)) as Migration;

    if (!migration.down) {
        throw new Error(`Migration ${lastMigration} does not export a 'down' function`);
    }

    try {
        db.transaction(() => {
            migration.down(db);
            unrecordMigration(lastMigration);
        })();

        console.log(`  ✓ Rolled back: ${lastMigration}`);
    } catch (error) {
        console.error(`  ✗ Failed to rollback migration ${lastMigration}:`, error);
        throw error;
    }
}

// CLI execution
if (require.main === module) {
    const command = process.argv[2];

    if (command === "rollback") {
        rollbackLastMigration().catch((error) => {
            console.error("Migration rollback failed:", error);
            process.exit(1);
        });
    } else {
        runMigrations().catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
    }
}
