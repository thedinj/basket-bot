import { describe, expect, it } from "vitest";
import { formatQuantity, formatQuantityWithUnit } from "./quantity";

describe("formatQuantity", () => {
    it.each([
        [2, "2"],
        [0.25, "0.25"],
        [1.5, "1.5"],
        [0.333, "0.33"],
        [0.1 + 0.2, "0.3"],
        [945, "945"],
    ])("formats %d as %j", (qty, expected) => {
        expect(formatQuantity(qty)).toBe(expected);
    });
});

describe("formatQuantityWithUnit", () => {
    it("joins a quantity and a unit", () => {
        expect(formatQuantityWithUnit(0.25, "cup")).toBe("0.25 cup");
    });

    it("shows a bare quantity", () => {
        expect(formatQuantityWithUnit(3, null)).toBe("3");
    });

    // Previously rendered as "( jar)" with a stray space.
    it("shows a bare unit with no leading space", () => {
        expect(formatQuantityWithUnit(null, "jar")).toBe("jar");
    });

    it("keeps a zero quantity", () => {
        expect(formatQuantityWithUnit(0, "cup")).toBe("0 cup");
    });

    it("is empty with neither", () => {
        expect(formatQuantityWithUnit(null, null)).toBe("");
        expect(formatQuantityWithUnit(null, "")).toBe("");
    });
});
