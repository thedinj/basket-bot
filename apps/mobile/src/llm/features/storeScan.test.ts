/**
 * `transformStoreScanResult` decides whether a re-scan updates the user's existing aisles
 * or duplicates them: a missed match creates a second "Produce" aisle and orphans every
 * item already filed under the first. It also owns the display order the user sees before
 * accepting the scan. Both behaviours are pure and were previously untested.
 */

import { describe, expect, it } from "vitest";
import { transformStoreScanResult, type StoreScanResult } from "./storeScan";

const scan = (aisles: StoreScanResult["aisles"]): StoreScanResult => ({ aisles });

describe("transformStoreScanResult", () => {
    it("refuses an empty scan rather than wiping the store layout", () => {
        expect(() => transformStoreScanResult(scan([]))).toThrow(/No aisles found/);
    });

    it("leaves ids undefined when there is nothing to match against", () => {
        const result = transformStoreScanResult(scan([{ name: "Produce", sections: ["Apples"] }]));

        expect(result.aisles).toEqual([{ id: undefined, name: "Produce", sortOrder: 0 }]);
        expect(result.sections).toEqual([
            { id: undefined, aisleName: "Produce", name: "Apples", sortOrder: 0 },
        ]);
    });

    it("preserves the id of an existing aisle so a re-scan updates instead of duplicating", () => {
        const result = transformStoreScanResult(
            scan([{ name: "Produce", sections: [] }]),
            [{ id: "aisle-1", name: "produce" }] // case differs; still the same aisle
        );

        expect(result.aisles[0].id).toBe("aisle-1");
    });

    it("preserves an id across a near-spelling the scan produced", () => {
        const result = transformStoreScanResult(scan([{ name: "Fresh Produce", sections: [] }]), [
            { id: "aisle-1", name: "Produce" },
        ]);

        expect(result.aisles[0].id).toBe("aisle-1");
    });

    it("treats a differently numbered aisle as a new aisle, not a match", () => {
        const result = transformStoreScanResult(scan([{ name: "Aisle 2", sections: [] }]), [
            { id: "aisle-1", name: "Aisle 1" },
        ]);

        expect(result.aisles[0].id).toBeUndefined();
    });

    it("preserves section ids alongside aisle ids", () => {
        const result = transformStoreScanResult(
            scan([{ name: "Dairy", sections: ["Cheese"] }]),
            [{ id: "aisle-1", name: "Dairy" }],
            [{ id: "section-1", name: "Cheese" }]
        );

        expect(result.sections[0]).toMatchObject({ id: "section-1", aisleName: "Dairy" });
    });

    it("trims whitespace from names before matching and storing", () => {
        const result = transformStoreScanResult(
            scan([{ name: "  Bakery  ", sections: ["  Bread  "] }]),
            [{ id: "aisle-1", name: "Bakery" }]
        );

        expect(result.aisles[0]).toMatchObject({ id: "aisle-1", name: "Bakery" });
        expect(result.sections[0].name).toBe("Bread");
    });

    it("orders unnumbered aisles before numbered ones", () => {
        const result = transformStoreScanResult(
            scan([
                { name: "Aisle 1", sections: [] },
                { name: "Produce", sections: [] },
                { name: "Bakery", sections: [] },
            ])
        );

        expect(result.aisles.map((a) => a.name)).toEqual(["Bakery", "Produce", "Aisle 1"]);
        expect(result.aisles.map((a) => a.sortOrder)).toEqual([0, 1, 2]);
    });

    it("orders numbered aisles naturally, not lexically", () => {
        const result = transformStoreScanResult(
            scan([
                { name: "Aisle 10", sections: [] },
                { name: "Aisle 2", sections: [] },
                { name: "Aisle 1", sections: [] },
            ])
        );

        expect(result.aisles.map((a) => a.name)).toEqual(["Aisle 1", "Aisle 2", "Aisle 10"]);
    });

    it("sorts sections naturally and restarts sortOrder for each aisle", () => {
        const result = transformStoreScanResult(
            scan([
                { name: "Bakery", sections: ["Rolls", "Bread"] },
                { name: "Dairy", sections: ["Yogurt", "Cheese"] },
            ])
        );

        expect(result.sections).toEqual([
            { id: undefined, aisleName: "Bakery", name: "Bread", sortOrder: 0 },
            { id: undefined, aisleName: "Bakery", name: "Rolls", sortOrder: 1 },
            { id: undefined, aisleName: "Dairy", name: "Cheese", sortOrder: 0 },
            { id: undefined, aisleName: "Dairy", name: "Yogurt", sortOrder: 1 },
        ]);
    });

    it("emits an aisle with no sections without inventing one", () => {
        const result = transformStoreScanResult(scan([{ name: "Bakery", sections: [] }]));

        expect(result.aisles).toHaveLength(1);
        expect(result.sections).toEqual([]);
    });

    it("matches a section by name alone, even under a different aisle", () => {
        // Documents current behaviour: section matching is a global name search, so a
        // section that moves aisles keeps its id and is re-parented rather than recreated.
        const result = transformStoreScanResult(
            scan([{ name: "Bakery", sections: ["Cheese"] }]),
            [],
            [{ id: "section-1", name: "Cheese" }]
        );

        expect(result.sections[0]).toMatchObject({ id: "section-1", aisleName: "Bakery" });
    });
});
