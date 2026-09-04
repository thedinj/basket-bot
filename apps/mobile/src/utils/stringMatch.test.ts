import { describe, expect, it } from "vitest";
import { FUZZY_MATCH_THRESHOLD, fuzzyMatch, normalizeForMatch } from "./stringMatch";

const matches = (a: string, b: string) => fuzzyMatch(a, b, FUZZY_MATCH_THRESHOLD);

describe("normalizeForMatch", () => {
    it("lowercases and trims", () => {
        expect(normalizeForMatch("  Dairy  ")).toBe("dairy");
    });
});

describe("fuzzyMatch", () => {
    it("matches identical strings ignoring case and surrounding space", () => {
        expect(matches("Produce", "  produce ")).toBe(true);
    });

    it("matches a near-spelling of the same name", () => {
        expect(matches("Produce", "Fresh Produce")).toBe(true);
    });

    // 0.7 is tighter than "lenient" suggests: enough extra text drops a real prefix match below
    // the bar. Pinned because the threshold constant's own comment used to claim otherwise.
    it("does not match a short name against a much longer one", () => {
        expect(matches("Dairy", "Dairy Products")).toBe(false);
    });

    it("rejects unrelated names", () => {
        expect(matches("Dairy", "Bakery")).toBe(false);
    });

    /**
     * The digits carve-out. "Aisle 1" and "Aisle 2" share almost every bigram, so the Dice
     * coefficient rates them ~0.86 — well above the 0.7 threshold — and fuzzy matching would
     * happily merge two different aisles during a store scan. Numbered names must match exactly.
     */
    it("requires an exact match when either side contains a digit", () => {
        expect(matches("Aisle 1", "Aisle 2")).toBe(false);
        expect(matches("Aisle 1", "Aisle 10")).toBe(false);
        expect(matches("Aisle 1", "Produce")).toBe(false);
    });

    it("still matches numbered names that differ only by case or spacing", () => {
        expect(matches("Aisle 1", "  aisle 1 ")).toBe(true);
    });

    it("honours the threshold it is given", () => {
        expect(fuzzyMatch("Dairy", "Bakery", 0.0)).toBe(true);
        expect(fuzzyMatch("Dairy", "Dairy Products", 0.99)).toBe(false);
    });

    it("does not match a name against the empty string", () => {
        expect(matches("Dairy", "")).toBe(false);
    });
});
