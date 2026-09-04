import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../lib/db/db";

/**
 * Proves the two definitions of the schema agree.
 *
 * A fresh install runs `initializeDatabase()` and never replays migrations, while an existing
 * install only ever sees the migrations. Nothing but discipline keeps the two in step, and the
 * CLAUDE.md checklist ("write the migration, update `init.ts`") exists precisely because it is
 * easy to do one and forget the other.
 *
 * So: build one database from `init.ts`, build another by replaying every migration onto an empty
 * database, and require the resulting schemas to be identical. This is only possible because
 * `00000000_000000_baseline` anchors the chain — before it existed the earliest migration assumed
 * tables that nothing had created, and a replay failed on the first statement.
 */

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

interface SchemaObject {
    type: string;
    name: string;
    sql: string | null;
}

/**
 * Split a `CREATE TABLE` body on its top-level commas, ignoring those nested inside `CHECK(...)`
 * or `FOREIGN KEY (...)`.
 */
const splitDefinitions = (body: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = "";

    for (const char of body) {
        if (char === "(") depth++;
        if (char === ")") depth--;
        if (char === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current.trim());

    return parts;
};

/**
 * A comparable form of one schema object.
 *
 * Column *order* is deliberately normalised away by sorting the definitions inside a
 * `CREATE TABLE`. A migrated database gets newer columns appended by `ALTER TABLE ADD COLUMN`
 * while `init.ts` declares them wherever they read best, so the two can never agree on order and
 * that difference carries no meaning. Everything that does — the column set, types, defaults,
 * CHECK constraints, foreign keys, uniqueness — survives the sort and is compared verbatim.
 */
const normalize = (object: SchemaObject): string => {
    const sql = (object.sql ?? "").replace(/\s+/g, " ").trim();
    const match = /^CREATE TABLE\s+"?\w+"?\s*\((.*)\)$/i.exec(sql);
    if (!match) {
        return `${object.type} ${object.name}\n${sql}`;
    }

    return `${object.type} ${object.name}\n${splitDefinitions(match[1]).sort().join(",\n  ")}`;
};

/** The schema as a comparable, column-order-insensitive list of strings. */
const describeSchema = (database: Database.Database): string[] =>
    (
        database
            .prepare(
                `SELECT type, name, sql FROM sqlite_master
                 WHERE name NOT LIKE 'sqlite_%' AND name != '_migrations'
                 ORDER BY type, name`
            )
            .all() as SchemaObject[]
    ).map(normalize);

/** Replay every migration, in filename order, onto an empty database. */
const buildFromMigrations = async (): Promise<Database.Database> => {
    const replayed = new Database(":memory:");
    // Migrations recreate tables to change constraints, which trips foreign keys mid-flight. The
    // real runner does the same.
    replayed.pragma("foreign_keys = OFF");

    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".ts"))
        .sort();

    for (const file of files) {
        const migration = (await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href)) as {
            up: (db: Database.Database) => void;
        };

        try {
            migration.up(replayed);
        } catch (error) {
            throw new Error(
                `Migration ${file} failed while replaying onto an empty database: ${
                    (error as Error).message
                }`
            );
        }
    }

    return replayed;
};

let fromMigrations: Database.Database;

beforeAll(async () => {
    fromMigrations = await buildFromMigrations();
});

describe("init.ts vs the migration history", () => {
    it("replays every migration onto an empty database", () => {
        // If the chain ever loses its anchor again, this is the assertion that says so.
        const tables = fromMigrations
            .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
            .all() as { name: string }[];

        expect(tables.length).toBeGreaterThan(5);
    });

    it("produces exactly the same schema as a fresh install", () => {
        const fresh = describeSchema(db);
        const replayed = describeSchema(fromMigrations);

        const freshSet = new Set(fresh);
        const replayedSet = new Set(replayed);

        // Reported as two lists rather than one diff so the failure says which side is behind:
        // something only in `init.ts` means a migration was never written; something only in the
        // replay means `init.ts` was never updated.
        expect({
            missingFromMigrations: fresh.filter((o) => !replayedSet.has(o)),
            missingFromInit: replayed.filter((o) => !freshSet.has(o)),
        }).toEqual({ missingFromMigrations: [], missingFromInit: [] });
    });

    it("agrees on the set of tables", () => {
        const names = (database: Database.Database) =>
            (
                database
                    .prepare(
                        `SELECT name FROM sqlite_master
                         WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_migrations'
                         ORDER BY name`
                    )
                    .all() as { name: string }[]
            ).map((r) => r.name);

        expect(names(fromMigrations)).toEqual(names(db));
    });

    // `StoreCollaborator` and `StoreInvitation` were replaced by household sharing. The baseline
    // creates them and a later migration drops them, so a correct replay ends without them.
    it("drops the tables that household sharing replaced", () => {
        const names = (
            fromMigrations.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as {
                name: string;
            }[]
        ).map((r) => r.name);

        expect(names).not.toContain("StoreCollaborator");
        expect(names).not.toContain("StoreInvitation");
    });
});
