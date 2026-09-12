import { describe, expect, it } from "vitest";
import { buildRecipeNote } from "./recipeNote";

describe("buildRecipeNote", () => {
    it("leaves the name alone at factor 1", () => {
        expect(buildRecipeNote({ name: "Chicken Parmesan" }, { factor: 1 })).toBe(
            "Chicken Parmesan"
        );
    });

    it("appends whole multipliers without a decimal tail", () => {
        expect(buildRecipeNote({ name: "Chicken Parmesan" }, { factor: 2 })).toBe(
            "Chicken Parmesan × 2"
        );
        expect(buildRecipeNote({ name: "Chicken Parmesan" }, { factor: 2.0 })).toBe(
            "Chicken Parmesan × 2"
        );
    });

    it("keeps fractional multipliers readable", () => {
        expect(buildRecipeNote({ name: "Soup" }, { factor: 1.5 })).toBe("Soup × 1.5");
        expect(buildRecipeNote({ name: "Soup" }, { factor: 0.5 })).toBe("Soup × 0.5");
    });

    it("trims floating-point noise", () => {
        expect(buildRecipeNote({ name: "Soup" }, { factor: 1 / 3 })).toBe("Soup × 0.3333");
    });

    it("falls back to the bare name for a non-finite factor", () => {
        expect(buildRecipeNote({ name: "Soup" }, { factor: Number.NaN })).toBe("Soup");
    });
});
