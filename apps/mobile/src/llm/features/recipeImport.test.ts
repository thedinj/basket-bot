/**
 * `applyShoppingMap` merges pass 2's (shopping-conversion) decisions back onto pass 1's
 * (extraction) recipe. Index-matching must be resilient to a missing/out-of-range index —
 * a dropped or misnumbered entry shouldn't cause the ingredient to lose its shopping-form
 * data entirely.
 */

import { describe, expect, it } from "vitest";
import { applyShoppingMap, type ParsedRecipe, type ShoppingMapResponse } from "./recipeImport";

const ingredient = (name: string, qty: number | null, unit: string | null) => ({
    name,
    qty,
    unit,
    shoppingName: undefined,
    shoppingQty: undefined,
    shoppingUnit: undefined,
    excluded: undefined,
});

const baseRecipe = (): ParsedRecipe => ({
    name: "Lemon Bars",
    source: undefined,
    description: null,
    steps: null,
    cookingTimeMinutes: null,
    ingredients: [
        ingredient("Lemon zest", 1, "tbsp"),
        ingredient("Lemon juice", 2, "oz"),
        ingredient("Salt", null, null),
    ],
});

describe("applyShoppingMap", () => {
    it("maps entries onto ingredients by index", () => {
        const map: ShoppingMapResponse = {
            ingredients: [
                { index: 0, excluded: true },
                { index: 1, shoppingName: "Lemon", shoppingQty: 1, excluded: false },
                { index: 2, excluded: true },
            ],
        };

        const result = applyShoppingMap(baseRecipe(), map);

        expect(result.ingredients[0]).toMatchObject({ name: "Lemon zest", excluded: true });
        expect(result.ingredients[1]).toMatchObject({
            name: "Lemon juice",
            shoppingName: "Lemon",
            shoppingQty: 1,
            excluded: false,
        });
        expect(result.ingredients[2]).toMatchObject({ name: "Salt", excluded: true });
    });

    it("falls back to array position when an index is missing or out of range", () => {
        const map: ShoppingMapResponse = {
            ingredients: [
                { excluded: true } as ShoppingMapResponse["ingredients"][number],
                { index: 99, shoppingName: "Lemon", excluded: false },
                { index: 2, excluded: true },
            ],
        };

        const result = applyShoppingMap(baseRecipe(), map);

        expect(result.ingredients[0]).toMatchObject({ name: "Lemon zest", excluded: true });
        expect(result.ingredients[1]).toMatchObject({ name: "Lemon juice", shoppingName: "Lemon" });
        expect(result.ingredients[2]).toMatchObject({ name: "Salt", excluded: true });
    });

    it("leaves name/qty/unit untouched and represents a combined-purchase group correctly", () => {
        const map: ShoppingMapResponse = {
            ingredients: [
                { index: 0, excluded: true },
                { index: 1, shoppingName: "Lemon", shoppingQty: 1, excluded: false },
                { index: 2, excluded: true },
            ],
        };

        const result = applyShoppingMap(baseRecipe(), map);

        expect(result.ingredients[0]).toMatchObject({ qty: 1, unit: "tbsp" });
        expect(result.ingredients[1]).toMatchObject({ qty: 2, unit: "oz" });
        // Only one ingredient in the group carries a real purchase.
        const excludedCount = result.ingredients.filter((i) => i.excluded).length;
        expect(excludedCount).toBe(2);
    });
});
