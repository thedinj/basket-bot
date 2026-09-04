import { QUANTITY_UNITS } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { db } from "../lib/db/db";

/**
 * `QUANTITY_UNITS` in `@basket-bot/core` and the seed rows in `init.ts` are two hand-maintained
 * copies of the same table, and the constant's own comment asks that they stay in sync. Adding a
 * unit to one and not the other silently gives the client a unit the database will reject as a
 * foreign key, or hides a seeded unit from every picker.
 */
describe("QuantityUnit seed", () => {
    it("matches QUANTITY_UNITS from @basket-bot/core exactly", () => {
        const seeded = db
            .prepare(
                `SELECT id, name, abbreviation, sortOrder, category FROM QuantityUnit ORDER BY id`
            )
            .all();

        const expected = [...QUANTITY_UNITS]
            .map((u) => ({
                id: u.id,
                name: u.name,
                abbreviation: u.abbreviation,
                sortOrder: u.sortOrder,
                category: u.category,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));

        expect(seeded).toEqual(expected);
    });
});
