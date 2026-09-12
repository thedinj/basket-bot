import type { RecipeWithDetails } from "@basket-bot/core";
import { compareTwoStrings } from "string-similarity";
import { normalizeForSearch } from "./stringUtils";

/**
 * Shared recipe search, filtering and sorting.
 *
 * This used to live in three places — the Recipes page, the meal-plan wizard's per-slot
 * filter, and the recipe picker modal — which had drifted apart: only one of them searched
 * `source`, none of them normalized plurals, and they disagreed about whether a recipe with
 * an unknown cooking time survives a max-cook-time filter. The backend's own rule
 * (`recipeRepo.ts`: recipes with a null `cookingTimeMinutes` fail the filter) is the one
 * encoded here, so the client and the server now select the same candidate set.
 */

export interface RecipeFilters {
    tagIds: Set<string>;
    tagMode: "any" | "all";
    maxCookingTimeMinutes: number | null;
    inPoolOnly: boolean;
    hasSteps: boolean;
}

export interface RecipeSort {
    by: "name" | "cookTime" | "ingredientCount" | "dateAdded";
    dir: "asc" | "desc";
}

export const DEFAULT_FILTERS: RecipeFilters = {
    tagIds: new Set(),
    tagMode: "any",
    maxCookingTimeMinutes: null,
    inPoolOnly: false,
    hasSteps: false,
};

export const DEFAULT_SORT: RecipeSort = { by: "name", dir: "asc" };

/**
 * The filter controls a surface chooses to offer. A surface that pins a filter (the meal
 * planner pins `inPoolOnly`, and `tagMode` because a plan slot can't persist it) leaves that
 * section out, which also suppresses its active-filter chip — a chip for a filter the user
 * can't change would do nothing when tapped.
 */
export type RecipeFilterSection = "sort" | "time" | "tags" | "tagMode" | "pool" | "steps";

export const ALL_FILTER_SECTIONS: readonly RecipeFilterSection[] = [
    "sort",
    "time",
    "tags",
    "tagMode",
    "pool",
    "steps",
];

/** The meal-plan wizard's persisted per-slot filter shape (`planSlotSchema`). */
export interface SlotFilters {
    tagIds: string[];
    maxCookingTimeMinutes: number | null;
}

/**
 * Minimum Dice-coefficient similarity for two word tokens to count as the same word.
 *
 * 0.7 comfortably clears real misspellings ("chiken"/"chicken" scores 0.73,
 * "spagetti"/"spaghetti" 0.80) while rejecting merely similar-looking words
 * ("beef"/"beer" scores 0.67, "pasta"/"pesto" 0.25).
 */
export const RECIPE_FUZZY_THRESHOLD = 0.7;

/** Below this length a token has too few bigrams for a similarity score to mean anything. */
const MIN_FUZZY_TOKEN_LENGTH = 3;

type SearchableRecipe = Pick<RecipeWithDetails, "name" | "source">;
type FilterableRecipe = Pick<
    RecipeWithDetails,
    "tags" | "cookingTimeMinutes" | "isPoolExcluded" | "steps"
>;
type SortableRecipe = Pick<
    RecipeWithDetails,
    "name" | "cookingTimeMinutes" | "ingredients" | "createdAt"
>;

function tokenize(value: string): string[] {
    return normalizeForSearch(value).split(" ").filter(Boolean);
}

/**
 * Plain substring search over name and source.
 *
 * `normalizeForSearch` is applied to both sides, per its own contract, so "apples" finds
 * "Apple Crisp". An empty query matches everything, so callers don't need their own guard.
 */
export function matchesRecipeSearch(recipe: SearchableRecipe, query: string): boolean {
    const q = normalizeForSearch(query);
    if (!q) return true;
    if (normalizeForSearch(recipe.name).includes(q)) return true;
    return recipe.source ? normalizeForSearch(recipe.source).includes(q) : false;
}

/**
 * Compare single words, tolerating misspellings.
 *
 * Deliberately not `fuzzyMatch` from `stringMatch.ts`: that compares whole strings, so a
 * one-word query scores near zero against a multi-word recipe name, and it rejects anything
 * containing a digit outright — which would make "15 Minute Pasta" unfindable. The digit
 * rule still applies per token, for the reason given there: shared prefixes make numbered
 * strings ("Aisle 1"/"Aisle 2") score misleadingly high.
 */
function tokensMatch(queryToken: string, nameToken: string): boolean {
    if (queryToken === nameToken) return true;
    if (/\d/.test(queryToken) || /\d/.test(nameToken)) return false;
    if (queryToken.length < MIN_FUZZY_TOKEN_LENGTH) return false;
    return compareTwoStrings(queryToken, nameToken) >= RECIPE_FUZZY_THRESHOLD;
}

/**
 * Substring search with a typo-tolerant fallback, so a bad speller still finds their recipe.
 *
 * Substring stays authoritative — fuzzy matching only runs on recipes it rejected, and only
 * against the name (a misspelled `source` is not worth the false positives it would add).
 * Matching is pass/fail rather than scored, so the caller's chosen sort order still governs
 * the result list.
 */
export function matchesRecipeSearchFuzzy(recipe: SearchableRecipe, query: string): boolean {
    if (matchesRecipeSearch(recipe, query)) return true;

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return true;

    const nameTokens = tokenize(recipe.name);
    return queryTokens.every((qTok) => nameTokens.some((nTok) => tokensMatch(qTok, nTok)));
}

export function matchesRecipeFilters(recipe: FilterableRecipe, filters: RecipeFilters): boolean {
    if (filters.tagIds.size > 0) {
        const matchesTags =
            filters.tagMode === "any"
                ? recipe.tags.some((t) => filters.tagIds.has(t.id))
                : [...filters.tagIds].every((id) => recipe.tags.some((t) => t.id === id));
        if (!matchesTags) return false;
    }

    // Recipes with null cookingTimeMinutes are excluded when a time filter is active —
    // unknown cook time might be 3 hours, so we can't promise it fits. The backend's
    // reroll applies the same rule, so both sides pick from the same set.
    if (filters.maxCookingTimeMinutes !== null) {
        if (recipe.cookingTimeMinutes === null) return false;
        if (recipe.cookingTimeMinutes > filters.maxCookingTimeMinutes) return false;
    }

    if (filters.inPoolOnly && recipe.isPoolExcluded) return false;
    if (filters.hasSteps && !recipe.steps?.trim()) return false;

    return true;
}

export function sortRecipes<T extends SortableRecipe>(recipes: T[], sort: RecipeSort): T[] {
    const d = sort.dir === "asc" ? 1 : -1;
    return [...recipes].sort((a, b) => {
        switch (sort.by) {
            case "name":
                return d * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
            case "cookTime": {
                // Unknown cook times sort last in both directions, rather than bunching at
                // whichever end the direction happens to put them.
                if (a.cookingTimeMinutes == null && b.cookingTimeMinutes == null) return 0;
                if (a.cookingTimeMinutes == null) return 1;
                if (b.cookingTimeMinutes == null) return -1;
                return d * (a.cookingTimeMinutes - b.cookingTimeMinutes);
            }
            case "ingredientCount": {
                const ca = a.ingredients.filter((i) => !i.excluded).length;
                const cb = b.ingredients.filter((i) => !i.excluded).length;
                return d * (ca - cb);
            }
            case "dateAdded":
                return d * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
    });
}

export function filterAndSortRecipes(
    recipes: RecipeWithDetails[],
    options: { query: string; filters: RecipeFilters; sort: RecipeSort }
): RecipeWithDetails[] {
    const matched = recipes.filter(
        (r) =>
            matchesRecipeSearchFuzzy(r, options.query) && matchesRecipeFilters(r, options.filters)
    );
    return sortRecipes(matched, options.sort);
}

/** Counts only filters the surface actually exposes — see {@link RecipeFilterSection}. */
export function countActiveFilters(
    filters: RecipeFilters,
    sort: RecipeSort,
    sections: readonly RecipeFilterSection[] = ALL_FILTER_SECTIONS
): number {
    let n = 0;
    if (sections.includes("tags") && filters.tagIds.size > 0) n++;
    if (sections.includes("time") && filters.maxCookingTimeMinutes !== null) n++;
    if (sections.includes("pool") && filters.inPoolOnly) n++;
    if (sections.includes("steps") && filters.hasSteps) n++;
    if (sections.includes("sort") && (sort.by !== DEFAULT_SORT.by || sort.dir !== DEFAULT_SORT.dir))
        n++;
    return n;
}

/**
 * Adapt a wizard slot's persisted filters into the shared shape.
 *
 * `tagMode` is pinned to "all" because that is what the server's reroll does; the wizard
 * therefore hides the any/all control rather than offering one the server would ignore.
 */
export function slotFiltersToRecipeFilters(slot: SlotFilters): RecipeFilters {
    return {
        ...DEFAULT_FILTERS,
        tagIds: new Set(slot.tagIds),
        tagMode: "all",
        maxCookingTimeMinutes: slot.maxCookingTimeMinutes,
    };
}

export function recipeFiltersToSlotFilters(filters: RecipeFilters): SlotFilters {
    return {
        tagIds: [...filters.tagIds],
        maxCookingTimeMinutes: filters.maxCookingTimeMinutes,
    };
}
