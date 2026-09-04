import { QUANTITY_UNITS } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { matchUnitId, naturalSort, toSentenceCase } from "./stringUtils";

// The real seeded table, so a rename or a new unit is exercised here rather than against a
// hand-written double that can drift from what the database actually holds.
const units = QUANTITY_UNITS.map((u) => ({
    id: u.id,
    abbreviation: u.abbreviation,
    name: u.name,
}));

const unitNamed = (name: string) => units.find((u) => u.name === name);

describe("toSentenceCase", () => {
    it("capitalizes the first letter and lowercases the rest", () => {
        expect(toSentenceCase("GREEN APPLES")).toBe("Green apples");
    });

    it("trims surrounding whitespace", () => {
        expect(toSentenceCase("  milk  ")).toBe("Milk");
    });

    it("passes through empty input", () => {
        expect(toSentenceCase("")).toBe("");
    });
});

describe("matchUnitId", () => {
    it("returns null when there is nothing to match", () => {
        expect(matchUnitId(null, units)).toBeNull();
        expect(matchUnitId(undefined, units)).toBeNull();
        expect(matchUnitId("lb", undefined)).toBeNull();
    });

    it("matches on abbreviation", () => {
        const pound = unitNamed("Pounds") ?? unitNamed("Pound");
        expect(matchUnitId(pound!.abbreviation, units)).toBe(pound!.id);
    });

    it("matches on full name", () => {
        const first = units[0];
        expect(matchUnitId(first.name, units)).toBe(first.id);
    });

    // LLM output arrives with punctuation and inconsistent plurals ("2 fl. oz."), so the
    // normalizer strips both before comparing.
    it("ignores punctuation and pluralization", () => {
        const first = units[0];
        expect(matchUnitId(`${first.abbreviation}.`, units)).toBe(first.id);
        expect(matchUnitId(first.abbreviation.toUpperCase(), units)).toBe(first.id);
    });

    it("returns null for an unrecognized unit", () => {
        expect(matchUnitId("parsecs", units)).toBeNull();
    });
});

describe("naturalSort", () => {
    // Plain lexicographic ordering puts "Aisle 10" before "Aisle 2", which is exactly the
    // ordering complaint that keeps coming back in aisle lists.
    it("orders embedded numbers numerically", () => {
        const names = ["Aisle 10", "Aisle 2", "Aisle 1"];
        expect([...names].sort(naturalSort((n) => n))).toEqual(["Aisle 1", "Aisle 2", "Aisle 10"]);
    });

    it("is case-insensitive", () => {
        const names = ["banana", "Apple"];
        expect([...names].sort(naturalSort((n) => n))).toEqual(["Apple", "banana"]);
    });

    it("sorts by the mapped property", () => {
        const rows = [{ name: "Aisle 10" }, { name: "Aisle 2" }];
        expect(rows.sort(naturalSort((r: { name: string }) => r.name)).map((r) => r.name)).toEqual([
            "Aisle 2",
            "Aisle 10",
        ]);
    });
});
