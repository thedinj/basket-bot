/**
 * Covers the two rules that decide what a meal plan actually adds to a shopping list: which
 * store an ingredient is bought from, and how much of it.
 *
 * Both rules used to exist twice — once in the meal plan wizard, once in the route
 * ingredients modal — so the risk this guards is drift between the screen the user makes a
 * choice on and the screen that acts on it. The `DEFAULT_STORE` sentinel is the sharp edge:
 * leaked through unresolved it becomes a store id that matches no store, and the ingredient
 * is silently dropped from the order.
 */

import { describe, expect, it } from "vitest";
import {
    DEFAULT_STORE,
    countRoutedIngredients,
    resolveIngredient,
    resolveIngredients,
    resolveStoreId,
    scaleQuantity,
    type IngredientRoutingContext,
    type RawIngredient,
} from "./ingredientRouting";

const ingredient = (overrides: Partial<RawIngredient> = {}): RawIngredient => ({
    id: "ing-1",
    recipeId: "recipe-1",
    name: "Flour",
    recipeName: "Bread",
    qty: 2,
    unitId: "unit-cup",
    excluded: false,
    isUnsure: false,
    ...overrides,
});

const context = (overrides: Partial<IngredientRoutingContext> = {}): IngredientRoutingContext => ({
    routeMap: new Map(),
    defaultStoreId: "store-default",
    unsureSet: new Set(),
    ...overrides,
});

describe("resolveStoreId", () => {
    it("swaps the sentinel for the default store", () => {
        expect(resolveStoreId(DEFAULT_STORE, "store-default")).toBe("store-default");
    });

    it("passes an explicitly chosen store straight through", () => {
        expect(resolveStoreId("store-other", "store-default")).toBe("store-other");
    });

    it("treats null as not being bought", () => {
        expect(resolveStoreId(null, "store-default")).toBeNull();
    });

    it("yields null when the sentinel has no default store behind it", () => {
        // Better to route nowhere than to leak "__default__" downstream as an id.
        expect(resolveStoreId(DEFAULT_STORE, null)).toBeNull();
    });
});

describe("scaleQuantity", () => {
    it("leaves a quantity untouched at the default factor", () => {
        expect(scaleQuantity(2, 1)).toBe(2);
    });

    it("scales a quantity up", () => {
        expect(scaleQuantity(2, 3)).toBe(6);
    });

    it("rounds away binary floating point noise", () => {
        // 0.1 * 3 is 0.30000000000000004 unrounded, which reaches the shopping list as-is.
        expect(scaleQuantity(0.1, 3)).toBe(0.3);
    });

    it("keeps four significant figures on a repeating result", () => {
        expect(scaleQuantity(1, 1 / 3)).toBe(0.3333);
    });

    it("returns null for an ingredient with no quantity", () => {
        expect(scaleQuantity(null, 4)).toBeNull();
    });
});

describe("resolveIngredient", () => {
    it("defaults an unrouted ingredient to not being bought", () => {
        // An ingredient absent from the route map has had no decision made about it.
        const result = resolveIngredient(ingredient(), context(), 1);
        expect(result.storeId).toBeNull();
    });

    it("resolves the sentinel to the default store", () => {
        const result = resolveIngredient(
            ingredient(),
            context({ routeMap: new Map([["ing-1", DEFAULT_STORE]]) }),
            1
        );
        expect(result.storeId).toBe("store-default");
    });

    it("honours a per-ingredient store override", () => {
        const result = resolveIngredient(
            ingredient(),
            context({ routeMap: new Map([["ing-1", "store-butcher"]]) }),
            1
        );
        expect(result.storeId).toBe("store-butcher");
    });

    it("keeps the original quantity alongside the scaled one", () => {
        // The UI renders "qty → scaledQty", so the pre-scale value has to survive.
        const result = resolveIngredient(ingredient({ qty: 2 }), context(), 2.5);
        expect(result).toMatchObject({ qty: 2, scaledQty: 5 });
    });

    it("takes the unsure flag from the user's selection, not the raw ingredient", () => {
        const result = resolveIngredient(
            ingredient({ isUnsure: false }),
            context({ unsureSet: new Set(["ing-1"]) }),
            1
        );
        expect(result.isUnsure).toBe(true);
    });

    it("clears the unsure flag when the user deselected it", () => {
        const result = resolveIngredient(ingredient({ isUnsure: true }), context(), 1);
        expect(result.isUnsure).toBe(false);
    });

    it("carries the excluded flag and recipe identity through unchanged", () => {
        const result = resolveIngredient(
            ingredient({ excluded: true, recipeName: "Bread", unitId: null }),
            context(),
            1
        );
        expect(result).toMatchObject({
            excluded: true,
            recipeId: "recipe-1",
            recipeName: "Bread",
            name: "Flour",
            unitId: null,
            ingredientId: "ing-1",
        });
    });
});

describe("resolveIngredients", () => {
    it("applies one shared factor across the list", () => {
        const result = resolveIngredients(
            [ingredient({ id: "a", qty: 1 }), ingredient({ id: "b", qty: 4 })],
            context(),
            2
        );
        expect(result.map((r) => r.scaledQty)).toEqual([2, 8]);
    });

    it("resolves each ingredient against its own route", () => {
        const result = resolveIngredients(
            [ingredient({ id: "a" }), ingredient({ id: "b" }), ingredient({ id: "c" })],
            context({
                routeMap: new Map([
                    ["a", DEFAULT_STORE],
                    ["b", "store-other"],
                    ["c", null],
                ]),
            }),
            1
        );
        expect(result.map((r) => r.storeId)).toEqual(["store-default", "store-other", null]);
    });

    it("returns an empty list for no ingredients", () => {
        expect(resolveIngredients([], context(), 1)).toEqual([]);
    });
});

describe("countRoutedIngredients", () => {
    it("counts only ingredients with somewhere to be bought from", () => {
        const resolved = resolveIngredients(
            [ingredient({ id: "a" }), ingredient({ id: "b" }), ingredient({ id: "c" })],
            context({
                routeMap: new Map([
                    ["a", DEFAULT_STORE],
                    ["b", "store-other"],
                ]),
            }),
            1
        );
        expect(countRoutedIngredients(resolved)).toBe(2);
    });

    it("does not count an ingredient whose sentinel resolved to nothing", () => {
        // The user checked it, but has no default store — it cannot be ordered.
        const resolved = resolveIngredients(
            [ingredient({ id: "a" })],
            context({ defaultStoreId: null, routeMap: new Map([["a", DEFAULT_STORE]]) }),
            1
        );
        expect(countRoutedIngredients(resolved)).toBe(0);
    });

    it("counts an excluded-but-routed ingredient, since routing is the decision that ships", () => {
        // `excluded` marks a pantry staple; it only hides the row by default. If the user
        // reveals it and routes it anyway, it is part of the order.
        const resolved = resolveIngredients(
            [ingredient({ id: "a", excluded: true })],
            context({ routeMap: new Map([["a", DEFAULT_STORE]]) }),
            1
        );
        expect(countRoutedIngredients(resolved)).toBe(1);
    });
});
