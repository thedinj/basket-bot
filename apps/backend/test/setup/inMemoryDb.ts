import Database from "better-sqlite3";

/**
 * Backend test harness: run every suite against a real SQLite schema held in memory.
 *
 * `src/lib/db/db.ts` resolves its connection as `globalThis.db ?? new Database(<cwd>/database.db)`
 * at module-evaluation time, and the repos only ever call `db.prepare(...)` *inside* functions.
 * So claiming `globalThis.db` before that module is ever evaluated redirects the whole backend
 * onto an in-memory database with no production code change at all.
 *
 * The import of `init.ts` must stay dynamic: a static import would be hoisted above the
 * assignment below and `db.ts` would open the on-disk file first. Vitest fully evaluates every
 * setup file before it imports the test module, so the test file's own hoisted imports cannot
 * beat this either.
 *
 * Scope: one fresh schema per test *file* (Vitest's default `isolate: true` re-runs this setup
 * in a new worker per file). For per-test isolation use `resetDb()` from `../support/resetDb`.
 */
const db = new Database(":memory:");
(globalThis as typeof globalThis & { db?: Database.Database }).db = db;

const { initializeDatabase } = await import("../../src/db/init");
initializeDatabase();
