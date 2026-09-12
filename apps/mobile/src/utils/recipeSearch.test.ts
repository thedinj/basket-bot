import type { RecipeWithDetails } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import {
    DEFAULT_FILTERS,
    DEFAULT_SORT,
    countActiveFilters,
    filterAndSortRecipes,
    matchesRecipeFilters,
    matchesRecipeSearch,
    matchesRecipeSearchFuzzy,
    recipeFiltersToSlotFilters,
    slotFiltersToRecipeFilters,
    sortRecipes,
    type RecipeFilters,
} from "./recipeSearch";

const makeRecipe = (overrides: Partial<RecipeWithDetails> = {}): RecipeWithDetails =>
    ({
        id: "r1",
        householdId: "h1",
        name: "Chicken Parmesan",
        description: null,
        steps: null,
        source: null,
        sourceUrl: null,
        isHidden: false,
        isPoolExcluded: false,
        cookingTimeMinutes: null,
        tags: [],
        ingredients: [],
        createdById: "u1",
        updatedById: "u1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    }) as RecipeWithDetails;

const filters = (
    overrides: Partial<Omit<RecipeFilters, "tagIds">> & { tagIds?: string[] } = {}
): RecipeFilters => ({
    ...DEFAULT_FILTERS,
    ...overrides,
    tagIds: new Set(overrides.tagIds ?? []),
});

describe("matchesRecipeSearch", () => {
    it("matches a substring of the name", () => {
        expect(matchesRecipeSearch(makeRecipe(), "parme")).toBe(true);
    });

    it("matches the source when the name does not", () => {
        const recipe = makeRecipe({ source: "Grandma's Cookbook" });
        expect(matchesRecipeSearch(recipe, "cookbook")).toBe(true);
    });

    it("is case insensitive", () => {
        expect(matchesRecipeSearch(makeRecipe(), "CHICKEN")).toBe(true);
    });

    it("treats plurals and singulars as the same word", () => {
        expect(matchesRecipeSearch(makeRecipe({ name: "Apple Crisp" }), "apples")).toBe(true);
    });

    it("matches everything for an empty or whitespace query", () => {
        expect(matchesRecipeSearch(makeRecipe(), "")).toBe(true);
        expect(matchesRecipeSearch(makeRecipe(), "   ")).toBe(true);
    });

    it("does not throw on a null source", () => {
        expect(matchesRecipeSearch(makeRecipe({ source: null }), "cookbook")).toBe(false);
    });

    it("rejects an unrelated query", () => {
        expect(matchesRecipeSearch(makeRecipe(), "lasagna")).toBe(false);
    });
});

describe("matchesRecipeSearchFuzzy", () => {
    it("finds a recipe despite a misspelled word", () => {
        expect(matchesRecipeSearchFuzzy(makeRecipe(), "chiken")).toBe(true);
        expect(matchesRecipeSearchFuzzy(makeRecipe(), "parmesian")).toBe(true);
    });

    it("handles a misspelling in a multi-word query", () => {
        expect(matchesRecipeSearchFuzzy(makeRecipe(), "chiken parmesan")).toBe(true);
    });

    it("finds a misspelled name with a different word count", () => {
        const recipe = makeRecipe({ name: "Spaghetti Bolognese" });
        expect(matchesRecipeSearchFuzzy(recipe, "spagetti")).toBe(true);
    });

    it("still matches plain substrings", () => {
        expect(matchesRecipeSearchFuzzy(makeRecipe(), "chicken")).toBe(true);
    });

    it("rejects an unrelated query", () => {
        expect(matchesRecipeSearchFuzzy(makeRecipe(), "salad")).toBe(false);
    });

    it("rejects a merely similar-looking word", () => {
        const recipe = makeRecipe({ name: "Beer Braised Ribs" });
        expect(matchesRecipeSearchFuzzy(recipe, "beef")).toBe(false);
    });

    it("does not fuzzy match on a query token too short to score meaningfully", () => {
        expect(matchesRecipeSearchFuzzy(makeRecipe({ name: "Pasta Bake" }), "ch")).toBe(false);
    });

    it("still finds a recipe whose name contains digits", () => {
        const recipe = makeRecipe({ name: "15 Minute Pasta" });
        expect(matchesRecipeSearchFuzzy(recipe, "pasta")).toBe(true);
        expect(matchesRecipeSearchFuzzy(recipe, "15")).toBe(true);
    });

    it("requires every query token to match something", () => {
        expect(matchesRecipeSearchFuzzy(makeRecipe(), "chiken lasagna")).toBe(false);
    });
});

describe("matchesRecipeFilters", () => {
    const tagged = makeRecipe({
        tags: [{ id: "t1" }, { id: "t2" }],
    } as Partial<RecipeWithDetails>);

    it("matches any selected tag in 'any' mode", () => {
        expect(
            matchesRecipeFilters(tagged, filters({ tagIds: ["t2", "t9"], tagMode: "any" }))
        ).toBe(true);
    });

    it("requires every selected tag in 'all' mode", () => {
        expect(
            matchesRecipeFilters(tagged, filters({ tagIds: ["t1", "t2"], tagMode: "all" }))
        ).toBe(true);
        expect(
            matchesRecipeFilters(tagged, filters({ tagIds: ["t1", "t9"], tagMode: "all" }))
        ).toBe(false);
    });

    it("keeps a recipe within the max cooking time", () => {
        const recipe = makeRecipe({ cookingTimeMinutes: 20 });
        expect(matchesRecipeFilters(recipe, filters({ maxCookingTimeMinutes: 30 }))).toBe(true);
        expect(matchesRecipeFilters(recipe, filters({ maxCookingTimeMinutes: 15 }))).toBe(false);
    });

    it("excludes a recipe with an unknown cooking time when a time filter is active", () => {
        const recipe = makeRecipe({ cookingTimeMinutes: null });
        expect(matchesRecipeFilters(recipe, filters({ maxCookingTimeMinutes: 30 }))).toBe(false);
        expect(matchesRecipeFilters(recipe, filters())).toBe(true);
    });

    it("applies the in-pool filter", () => {
        const excluded = makeRecipe({ isPoolExcluded: true });
        expect(matchesRecipeFilters(excluded, filters({ inPoolOnly: true }))).toBe(false);
        expect(matchesRecipeFilters(excluded, filters())).toBe(true);
    });

    it("applies the has-steps filter", () => {
        expect(
            matchesRecipeFilters(makeRecipe({ steps: "   " }), filters({ hasSteps: true }))
        ).toBe(false);
        expect(
            matchesRecipeFilters(makeRecipe({ steps: "Preheat." }), filters({ hasSteps: true }))
        ).toBe(true);
    });
});

describe("sortRecipes", () => {
    it("sorts unknown cooking times last in both directions", () => {
        const recipes = [
            makeRecipe({ id: "a", cookingTimeMinutes: null }),
            makeRecipe({ id: "b", cookingTimeMinutes: 30 }),
            makeRecipe({ id: "c", cookingTimeMinutes: 10 }),
        ];
        expect(sortRecipes(recipes, { by: "cookTime", dir: "asc" }).map((r) => r.id)).toEqual([
            "c",
            "b",
            "a",
        ]);
        expect(sortRecipes(recipes, { by: "cookTime", dir: "desc" }).map((r) => r.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    it("does not mutate the input array", () => {
        const recipes = [makeRecipe({ id: "b", name: "B" }), makeRecipe({ id: "a", name: "A" })];
        sortRecipes(recipes, DEFAULT_SORT);
        expect(recipes.map((r) => r.id)).toEqual(["b", "a"]);
    });
});

describe("filterAndSortRecipes", () => {
    it("applies search and filters together, then sorts", () => {
        const recipes = [
            makeRecipe({ id: "a", name: "Chicken Soup", cookingTimeMinutes: 45 }),
            makeRecipe({ id: "b", name: "Chicken Salad", cookingTimeMinutes: 10 }),
            makeRecipe({ id: "c", name: "Beef Stew", cookingTimeMinutes: 20 }),
        ];
        const result = filterAndSortRecipes(recipes, {
            query: "chiken",
            filters: filters({ maxCookingTimeMinutes: 30 }),
            sort: DEFAULT_SORT,
        });
        expect(result.map((r) => r.id)).toEqual(["b"]);
    });
});

describe("countActiveFilters", () => {
    it("counts each active filter and a non-default sort", () => {
        expect(countActiveFilters(filters(), DEFAULT_SORT)).toBe(0);
        expect(countActiveFilters(filters({ tagIds: ["t1"] }), DEFAULT_SORT)).toBe(1);
        expect(
            countActiveFilters(filters({ tagIds: ["t1"], hasSteps: true }), {
                by: "cookTime",
                dir: "asc",
            })
        ).toBe(3);
    });

    it("ignores filters the surface does not expose", () => {
        // The planner pins inPoolOnly, so it must not show up as a clearable filter.
        const pinned = filters({ inPoolOnly: true, tagIds: ["t1"] });
        expect(countActiveFilters(pinned, DEFAULT_SORT)).toBe(2);
        expect(countActiveFilters(pinned, DEFAULT_SORT, ["sort", "time", "tags"])).toBe(1);
    });
});

describe("slot filter adapters", () => {
    it("pins tagMode to 'all', matching the server's reroll", () => {
        const result = slotFiltersToRecipeFilters({
            tagIds: ["t1", "t2"],
            maxCookingTimeMinutes: 30,
        });
        expect(result.tagMode).toBe("all");
        expect([...result.tagIds]).toEqual(["t1", "t2"]);
        expect(result.maxCookingTimeMinutes).toBe(30);
    });

    it("round-trips the persisted fields without loss", () => {
        const slot = { tagIds: ["t1"], maxCookingTimeMinutes: 45 };
        expect(recipeFiltersToSlotFilters(slotFiltersToRecipeFilters(slot))).toEqual(slot);
    });
});
