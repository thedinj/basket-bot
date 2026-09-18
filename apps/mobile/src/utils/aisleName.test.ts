import { describe, expect, it } from "vitest";
import { parseAisleName } from "./aisleName";

describe("parseAisleName", () => {
    it.each([
        ["12", { code: "12", label: "" }],
        ["Aisle 1", { code: "1", label: "" }],
        ["Aisle12", { code: "12", label: "" }],
        ["aisle 14b", { code: "14B", label: "" }],
        ["#5 Paper goods", { code: "5", label: "Paper goods" }],
        ["3 - Cereal & Breakfast", { code: "3", label: "Cereal & Breakfast" }],
        ["Aisle 7: Baking, Spices", { code: "7", label: "Baking, Spices" }],
        ["4. Pasta", { code: "4", label: "Pasta" }],
        ["Snacks (Aisle 9)", { code: "9", label: "Snacks" }],
        ["Snacks - aisle 9", { code: "9", label: "Snacks" }],
    ])("reads a number from %j", (name, expected) => {
        expect(parseAisleName(name)).toEqual(expected);
    });

    it.each(["Produce", "1st floor", "Deli / Bakery Counter (back left)", "Snacks 9", "Aisle"])(
        "leaves %j without a number",
        (name) => {
            expect(parseAisleName(name)).toEqual({ code: null, label: name });
        }
    );

    it("trims surrounding whitespace", () => {
        expect(parseAisleName("  Produce  ")).toEqual({ code: null, label: "Produce" });
    });
});
