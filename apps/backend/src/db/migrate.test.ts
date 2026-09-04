import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db/db";
import { initializeDatabase } from "./init";
import { markAllMigrationsApplied, runMigrations } from "./migrate";

/**
 * The migration runner has to cope with three genuinely different starting states, and getting any
 * of them wrong is a deployment failure rather than a test failure:
 *
 *  1. a freshly `db:init`-ed database — already at the current schema, so nothing should run
 *  2. an empty database — the baseline anchors the chain and everything runs
 *  3. an existing install — pending migrations run, but the baseline must never re-create the
 *     tables a later migration deliberately dropped
 */

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const BASELINE = "00000000_000000_baseline.ts";

const allMigrationFiles = (): string[] =>
    fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".ts"))
        .sort();

const appliedMigrations = (): string[] =>
    (db.prepare(`SELECT filename FROM "_migrations" ORDER BY id`).all() as { filename: string }[])
        .map((r) => r.filename)
        .sort();

const tableNames = (): string[] =>
    (
        db
            .prepare(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
            )
            .all() as { name: string }[]
    ).map((r) => r.name);

/** Return the database to a completely empty state. */
const dropEverything = (): void => {
    db.pragma("foreign_keys = OFF");
    for (const name of tableNames()) {
        db.exec(`DROP TABLE IF EXISTS "${name}"`);
    }
    db.pragma("foreign_keys = ON");
};

beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    // Leave the shared in-memory database as other suites expect to find it.
    dropEverything();
    initializeDatabase();
});

describe("a freshly initialised database", () => {
    /**
     * The bug this fixes: `init.ts` builds the current schema outright, but nothing recorded that,
     * so `db:migrate` would try to replay from the beginning and die on the first migration —
     * which adds a column `init.ts` already creates.
     */
    it("has every migration stamped, so db:migrate is a no-op", async () => {
        dropEverything();
        initializeDatabase();
        markAllMigrationsApplied();

        expect(appliedMigrations()).toEqual(allMigrationFiles());

        await expect(runMigrations()).resolves.toBeUndefined();
    });

    it("stamps idempotently", () => {
        dropEverything();
        initializeDatabase();
        markAllMigrationsApplied();
        markAllMigrationsApplied();

        expect(appliedMigrations()).toEqual(allMigrationFiles());
    });
});

describe("an empty database", () => {
    it("runs every migration, baseline first", async () => {
        dropEverything();

        await runMigrations();

        expect(appliedMigrations()).toEqual(allMigrationFiles());
        expect(tableNames()).toContain("User");
        expect(tableNames()).toContain("RecipeIngredient");
    });
});

describe("an existing installation", () => {
    /**
     * An install that predates the baseline has migration rows but no baseline row. Running the
     * baseline there would `CREATE TABLE IF NOT EXISTS` its way to resurrecting `StoreCollaborator`
     * and `StoreInvitation`, which `20260207_010000` dropped on purpose. It must be stamped, not
     * executed.
     */
    it("records the baseline without running it", async () => {
        dropEverything();
        initializeDatabase();
        markAllMigrationsApplied();
        // Simulate a database that never saw the baseline.
        db.prepare(`DELETE FROM "_migrations" WHERE filename = ?`).run(BASELINE);

        await runMigrations();

        expect(appliedMigrations()).toContain(BASELINE);
        expect(tableNames()).not.toContain("StoreCollaborator");
        expect(tableNames()).not.toContain("StoreInvitation");
    });

    it("applies only the migrations it has not seen", async () => {
        dropEverything();
        initializeDatabase();
        markAllMigrationsApplied();

        const latest = allMigrationFiles().at(-1)!;
        db.prepare(`DELETE FROM "_migrations" WHERE filename = ?`).run(latest);

        await runMigrations();

        expect(appliedMigrations()).toEqual(allMigrationFiles());
    });
});
