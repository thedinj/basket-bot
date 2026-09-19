import type { RecipeIngredient, RecipeWithDetails } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { formatIngredientAmount, formatRecipeAsText, splitRecipeSteps } from "./recipeText";

const makeIngredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient =>
    ({
        id: "i1",
        recipeId: "r1",
        name: "flour",
        shoppingName: null,
        qty: null,
        shoppingQty: null,
        unitId: null,
        shoppingUnitId: null,
        sortOrder: 0,
        notes: null,
        excluded: false,
        isUnsure: null,
        ...overrides,
    }) as RecipeIngredient;

const makeRecipe = (overrides: Partial<RecipeWithDetails> = {}): RecipeWithDetails =>
    ({
        id: "r1",
        householdId: "h1",
        name: "Pancakes",
        description: null,
        steps: null,
        source: null,
        sourceUrl: null,
        isHidden: false,
        isPoolExcluded: false,
        cookingTimeMinutes: null,
        tags: [],
        ingredients: [],
        ...overrides,
    }) as RecipeWithDetails;

const units = new Map([["u-cup", "cup"]]);

describe("splitRecipeSteps", () => {
    it("returns one step per non-blank line", () => {
        expect(splitRecipeSteps("Mix\n\n  Bake  \r\nServe")).toEqual(["Mix", "Bake", "Serve"]);
    });

    it("drops numbering and bullets the text brought along", () => {
        expect(
            splitRecipeSteps("1. Mix\n2) Rest\nStep 3: Bake\n4 - Cool\n- Slice\n• Serve")
        ).toEqual(["Mix", "Rest", "Bake", "Cool", "Slice", "Serve"]);
    });

    it("keeps a number that is part of the step", () => {
        expect(
            splitRecipeSteps("350 degrees for 20 minutes\n1.5 cups water\n2-3 minutes more")
        ).toEqual(["350 degrees for 20 minutes", "1.5 cups water", "2-3 minutes more"]);
    });

    it("is empty for missing or blank steps", () => {
        expect(splitRecipeSteps(null)).toEqual([]);
        expect(splitRecipeSteps(" \n ")).toEqual([]);
    });
});

describe("formatIngredientAmount", () => {
    it("joins a trimmed quantity and the unit's name", () => {
        expect(formatIngredientAmount(0.1 + 0.2, "u-cup", units)).toBe("0.3 cup");
    });

    it("falls back to the unit id when the unit is unknown", () => {
        expect(formatIngredientAmount(2, "pinch", units)).toBe("2 pinch");
    });

    it("is empty with neither quantity nor unit", () => {
        expect(formatIngredientAmount(null, null, units)).toBe("");
    });
});

describe("formatRecipeAsText", () => {
    it("lays out every block separated by blank lines", () => {
        const recipe = makeRecipe({
            source: "Grandma",
            ingredients: [
                makeIngredient({ qty: 1.5, unitId: "u-cup" }),
                makeIngredient({ id: "i2", name: "eggs", qty: 2, notes: "beaten" }),
                makeIngredient({ id: "i3", name: "salt" }),
            ],
            steps: "1. Mix\n2. Cook",
            description: "Freezes well.",
        });

        expect(formatRecipeAsText(recipe, units)).toBe(
            [
                "Pancakes\nGrandma",
                "Ingredients\n1.5 cup flour\n2 eggs (beaten)\nsalt",
                "Steps\n1. Mix\n2. Cook",
                "Notes\nFreezes well.",
            ].join("\n\n")
        );
    });

    it("leaves a single step unnumbered and skips empty blocks", () => {
        expect(formatRecipeAsText(makeRecipe({ steps: "Just toast it." }), units)).toBe(
            "Pancakes\n\nSteps\nJust toast it."
        );
    });
});
