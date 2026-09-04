import { describe, expect, it } from "vitest";
import { db } from "../lib/db/db";

/**
 * A committed snapshot of the schema `init.ts` produces for a fresh database.
 *
 * This is not here to catch "someone changed the schema" — that is the normal way to work. It is
 * here so that a schema change shows up in review as a readable SQL diff instead of being buried
 * in a 400-line diff of `init.ts`, and so the CLAUDE.md three-step checklist (migration +
 * `init.ts` + core zod schemas) has something that visibly moves when step 2 happens.
 *
 * To accept an intentional change: run `pnpm test -u` and review the diff to
 * `__snapshots__/schema.sql` as part of the change.
 */
describe("init.ts schema", () => {
    it("matches the committed snapshot", async () => {
        const objects = db
            .prepare(
                `SELECT type, name, tbl_name, sql FROM sqlite_master
                 WHERE name NOT LIKE 'sqlite_%'
                 ORDER BY type, tbl_name, name`
            )
            .all() as { type: string; name: string; tbl_name: string; sql: string | null }[];

        // Collapse whitespace so re-indenting `init.ts` doesn't churn the snapshot; only the
        // actual SQL shape matters here.
        const dump = objects
            .map(
                ({ type, name, sql }) =>
                    `-- ${type} ${name}\n${(sql ?? "").replace(/\s+/g, " ").trim()};`
            )
            .join("\n\n");

        await expect(dump).toMatchFileSnapshot("./__snapshots__/schema.sql");
    });
});
