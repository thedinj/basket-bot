import { describe, expect, it } from "vitest";
import { normalizeForSearch, normalizeItemName } from "./normalizeName";

describe("normalizeItemName", () => {
    it("trims and lowercases", () => {
        expect(normalizeItemName("  Spices  ")).toBe("spices");
    });

    it("collapses internal whitespace runs", () => {
        expect(normalizeItemName("Spi  ces")).toBe("spi ces");
        expect(normalizeItemName("Green\t\tApples")).toBe("green apples");
    });

    /**
     * The contract that matters. This is the storage key behind
     * `UNIQUE (storeId, nameNorm)`, so singular and plural must stay *distinct* — the client
     * bug this function was extracted to fix came from one side singularizing and the other not.
     */
    it("does not singularize", () => {
        expect(normalizeItemName("Apples")).toBe("apples");
        expect(normalizeItemName("Apple")).toBe("apple");
        expect(normalizeItemName("Apples")).not.toBe(normalizeItemName("Apple"));
    });

    it("is idempotent", () => {
        for (const input of ["  Green  Apples ", "spices", "A"]) {
            expect(normalizeItemName(normalizeItemName(input))).toBe(normalizeItemName(input));
        }
    });

    it("leaves unicode and emoji intact", () => {
        expect(normalizeItemName("  Jalapeño  ")).toBe("jalapeño");
        expect(normalizeItemName("Café  Beans")).toBe("café beans");
        expect(normalizeItemName("🍎 Apples")).toBe("🍎 apples");
    });
});

describe("normalizeForSearch", () => {
    it("does everything normalizeItemName does, then singularizes", () => {
        expect(normalizeForSearch("  Green   Apples ")).toBe("green apple");
        expect(normalizeForSearch("  Jalapeño  ")).toBe("jalapeño");
    });

    // pluralize only inflects the final word, so multi-word names keep their leading words.
    it("singularizes only the last word", () => {
        expect(normalizeForSearch("Green Beans")).toBe("green bean");
    });

    it("collapses singular and plural onto one term", () => {
        expect(normalizeForSearch("Apples")).toBe(normalizeForSearch("apple"));
    });

    // The distinction the two functions exist to keep: search is lenient, storage is not.
    it("differs from the storage key exactly where singularization applies", () => {
        expect(normalizeForSearch("Apples")).not.toBe(normalizeItemName("Apples"));
        expect(normalizeForSearch("Apple")).toBe(normalizeItemName("Apple"));
    });
});
