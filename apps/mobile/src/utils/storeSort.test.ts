import { describe, expect, it } from "vitest";
import { sortStoresByPreference } from "./storeSort";

const store = (name: string, sortOrder?: number | null) => ({ name, sortOrder });

describe("sortStoresByPreference", () => {
    it("falls back to case-insensitive alphabetical when no store has a position", () => {
        const sorted = sortStoresByPreference([store("zebra"), store("Apple"), store("mango")]);
        expect(sorted.map((s) => s.name)).toEqual(["Apple", "mango", "zebra"]);
    });

    it("orders by custom position when every store has one", () => {
        const sorted = sortStoresByPreference([store("A", 2), store("B", 0), store("C", 1)]);
        expect(sorted.map((s) => s.name)).toEqual(["B", "C", "A"]);
    });

    // The regression that keeps recurring: a store with no saved position must sink below the
    // ordered ones rather than being compared numerically against them.
    it("puts positioned stores ahead of unpositioned ones regardless of name", () => {
        const sorted = sortStoresByPreference([
            store("Aardvark"),
            store("Zulu", 5),
            store("Baker"),
        ]);
        expect(sorted.map((s) => s.name)).toEqual(["Zulu", "Aardvark", "Baker"]);
    });

    it("treats sortOrder 0 as a real position, not as absent", () => {
        const sorted = sortStoresByPreference([store("Unset"), store("First", 0)]);
        expect(sorted.map((s) => s.name)).toEqual(["First", "Unset"]);
    });

    it("treats undefined and null sortOrder identically", () => {
        const withNull = sortStoresByPreference([store("B", null), store("A", null)]);
        const withUndefined = sortStoresByPreference([store("B"), store("A")]);
        expect(withNull.map((s) => s.name)).toEqual(withUndefined.map((s) => s.name));
    });

    it("does not mutate the input array", () => {
        const input = [store("B", 1), store("A", 0)];
        const snapshot = [...input];
        sortStoresByPreference(input);
        expect(input).toEqual(snapshot);
    });
});
