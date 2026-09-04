import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureHarness, harness } from "./testSupport/hookHarness";
import { queryKeys } from "./queryKeys";

/**
 * The recipes/plans half of `docs/CACHE_KEYS.md` §2, made executable — the companion to
 * `cacheCascade.test.ts`, which covers the store domain.
 *
 * This half is where the documented cascades are least obvious. A recipe list carries *full*
 * ingredient details, so an ingredient edit has to invalidate the list as well as the recipe it
 * belongs to; tags are denormalised onto recipes, so renaming one has to reach the recipe list;
 * and dispatching a plan writes shopping-list items across an unknown set of stores, so it has to
 * invalidate every store's caches rather than one. §4 calls the first of those out by name.
 */

vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-query")>();
    const { harness: h } = await import("./testSupport/hookHarness");
    return {
        ...actual,
        useQueryClient: () => h.client,
        useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
        useSuspenseQuery: () => ({ data: undefined }),
        useInfiniteQuery: () => ({ data: undefined, isLoading: false }),
        useMutation: (options: never) => h.register(options),
    };
});

vi.mock("../hooks/useToast", () => ({
    useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showToast: vi.fn() }),
}));

/**
 * These hooks call HTTP directly rather than going through `useDatabase`, so the API module is
 * their database double. Several hooks key their invalidation off the *response* rather than the
 * variables, so the stubs echo the ids the table below asserts on. The literals are repeated
 * because a hoisted `vi.mock` factory cannot reference module-level consts.
 */
vi.mock("../lib/api/meals", () => {
    const ok = () =>
        vi.fn().mockResolvedValue({ id: "plan-1", recipeId: "recipe-1", itemsAdded: 3 });
    return {
        recipeApi: {
            createRecipe: ok(),
            updateRecipe: ok(),
            deleteRecipe: ok(),
            addToShoppingList: ok(),
            assignTag: ok(),
            removeTag: ok(),
            createTag: ok(),
            updateTag: ok(),
            deleteTag: ok(),
            addIngredient: ok(),
            updateIngredient: ok(),
            deleteIngredient: ok(),
            getRecipes: ok(),
            getRecipe: ok(),
            getTags: ok(),
            getPoolCount: ok(),
        },
        planApi: {
            createPlan: ok(),
            updatePlan: ok(),
            deletePlan: ok(),
            updateSlots: ok(),
            updateRoutes: ok(),
            rerollSlots: ok(),
            dispatchPlan: ok(),
            getPlan: ok(),
            getPlans: ok(),
            getPlansHistory: ok(),
        },
    };
});

// The mock spreads `...actual`, so this is the genuine QueryClient class.
import { QueryClient } from "@tanstack/react-query";
configureHarness(QueryClient);

import * as mealsHooks from "./mealsHooks";

const HOUSEHOLD = "household-1";
const RECIPE = "recipe-1";
const PLAN = "plan-1";
const TAG = "tag-1";
const INGREDIENT = "ingredient-1";

/**
 * Unlike the store hooks, every meals hook takes `householdId` as a factory argument (it is null
 * while the household loads), so each row builds its own hook rather than naming one.
 */
interface Cascade {
    name: string;
    hook: () => { mutateAsync: (variables: never) => Promise<unknown> };
    vars: unknown;
    invalidates: unknown[][];
}

const CASCADES: Cascade[] = [
    // --- Recipes ---
    {
        name: "useCreateRecipe",
        hook: () => mealsHooks.useCreateRecipe(HOUSEHOLD),
        vars: { name: "Chilli" },
        invalidates: [queryKeys.recipes.byHousehold(HOUSEHOLD)],
    },
    {
        name: "useUpdateRecipe",
        hook: () => mealsHooks.useUpdateRecipe(HOUSEHOLD),
        vars: { recipeId: RECIPE, data: { name: "Chilli" } },
        invalidates: [
            queryKeys.recipes.byHousehold(HOUSEHOLD),
            queryKeys.recipes.detail(HOUSEHOLD, RECIPE),
        ],
    },
    {
        name: "useDeleteRecipe",
        hook: () => mealsHooks.useDeleteRecipe(HOUSEHOLD),
        vars: RECIPE,
        invalidates: [queryKeys.recipes.byHousehold(HOUSEHOLD)],
    },
    {
        // Writes list items and possibly store items across several stores at once, so it uses the
        // broad prefixes deliberately — the affected set is not knowable here.
        name: "useAddRecipeToShoppingList",
        hook: () => mealsHooks.useAddRecipeToShoppingList(HOUSEHOLD, RECIPE),
        vars: { routes: [{ ingredientId: INGREDIENT, storeId: "store-1", isUnsure: false }] },
        invalidates: [queryKeys.shoppingListItems.all(), queryKeys.items.all()],
    },

    // --- Tags ---
    {
        name: "useAssignTag",
        hook: () => mealsHooks.useAssignTag(HOUSEHOLD),
        vars: { recipeId: RECIPE, tagId: TAG },
        invalidates: [
            queryKeys.recipes.byHousehold(HOUSEHOLD),
            queryKeys.recipes.detail(HOUSEHOLD, RECIPE),
        ],
    },
    {
        name: "useRemoveTag",
        hook: () => mealsHooks.useRemoveTag(HOUSEHOLD),
        vars: { recipeId: RECIPE, tagId: TAG },
        invalidates: [
            queryKeys.recipes.byHousehold(HOUSEHOLD),
            queryKeys.recipes.detail(HOUSEHOLD, RECIPE),
        ],
    },
    {
        name: "useCreateTag",
        hook: () => mealsHooks.useCreateTag(HOUSEHOLD),
        vars: { name: "Quick", colorKey: "red" },
        invalidates: [queryKeys.tags(HOUSEHOLD)],
    },
    {
        // Tag names/colours are denormalised onto recipes, so a rename has to reach the recipe
        // list or cards keep rendering the old label.
        name: "useUpdateTag",
        hook: () => mealsHooks.useUpdateTag(HOUSEHOLD),
        vars: { tagId: TAG, data: { name: "Quick" } },
        invalidates: [queryKeys.tags(HOUSEHOLD), queryKeys.recipes.byHousehold(HOUSEHOLD)],
    },
    {
        name: "useDeleteTag",
        hook: () => mealsHooks.useDeleteTag(HOUSEHOLD),
        vars: TAG,
        invalidates: [queryKeys.tags(HOUSEHOLD), queryKeys.recipes.byHousehold(HOUSEHOLD)],
    },

    // --- Ingredients (see the §4 note below) ---
    {
        name: "useAddIngredient",
        hook: () => mealsHooks.useAddIngredient(HOUSEHOLD),
        vars: { recipeId: RECIPE, data: { name: "Beans" } },
        invalidates: [
            queryKeys.recipes.detail(HOUSEHOLD, RECIPE),
            queryKeys.recipes.byHousehold(HOUSEHOLD),
        ],
    },
    {
        name: "useUpdateIngredient",
        hook: () => mealsHooks.useUpdateIngredient(HOUSEHOLD),
        vars: { recipeId: RECIPE, ingredientId: INGREDIENT, data: { name: "Beans" } },
        invalidates: [
            queryKeys.recipes.detail(HOUSEHOLD, RECIPE),
            queryKeys.recipes.byHousehold(HOUSEHOLD),
        ],
    },
    {
        name: "useDeleteIngredient",
        hook: () => mealsHooks.useDeleteIngredient(HOUSEHOLD),
        vars: { recipeId: RECIPE, ingredientId: INGREDIENT },
        invalidates: [
            queryKeys.recipes.detail(HOUSEHOLD, RECIPE),
            queryKeys.recipes.byHousehold(HOUSEHOLD),
        ],
    },

    // --- Plans ---
    {
        name: "useCreatePlan",
        hook: () => mealsHooks.useCreatePlan(HOUSEHOLD),
        vars: { slotCount: 3 },
        invalidates: [queryKeys.plans.byHousehold(HOUSEHOLD)],
    },
    {
        name: "useUpdatePlan",
        hook: () => mealsHooks.useUpdatePlan(HOUSEHOLD),
        vars: { planId: PLAN, data: { name: "Week 1" } },
        invalidates: [
            queryKeys.plans.detail(HOUSEHOLD, PLAN),
            queryKeys.plans.byHousehold(HOUSEHOLD),
        ],
    },
    {
        name: "useDeletePlan",
        hook: () => mealsHooks.useDeletePlan(HOUSEHOLD),
        vars: PLAN,
        invalidates: [queryKeys.plans.byHousehold(HOUSEHOLD)],
    },
    {
        name: "useUpdatePlanSlots",
        hook: () => mealsHooks.useUpdatePlanSlots(HOUSEHOLD),
        vars: { planId: PLAN, slots: [] },
        invalidates: [queryKeys.plans.detail(HOUSEHOLD, PLAN)],
    },
    {
        name: "useUpdatePlanRoutes",
        hook: () => mealsHooks.useUpdatePlanRoutes(HOUSEHOLD),
        vars: { planId: PLAN, routes: [] },
        invalidates: [queryKeys.plans.detail(HOUSEHOLD, PLAN)],
    },
    {
        name: "useRerollSlots",
        hook: () => mealsHooks.useRerollSlots(HOUSEHOLD),
        vars: { planId: PLAN, slots: [1] },
        invalidates: [queryKeys.plans.detail(HOUSEHOLD, PLAN)],
    },
    {
        // The widest cascade in the app: dispatch writes list items and store items across every
        // store the plan routes to, and also lands the plan in history.
        name: "useDispatchPlan",
        hook: () => mealsHooks.useDispatchPlan(HOUSEHOLD),
        vars: { planId: PLAN },
        invalidates: [
            queryKeys.plans.byHousehold(HOUSEHOLD),
            queryKeys.plans.detail(HOUSEHOLD, PLAN),
            queryKeys.plansHistory(HOUSEHOLD),
            queryKeys.shoppingListItems.all(),
            queryKeys.items.all(),
        ],
    },
];

/** Query hooks and other non-mutation exports, listed explicitly — see the guard below. */
const NON_MUTATION_HOOKS = new Set([
    "useRecipes",
    "useRecipe",
    "useTags",
    "usePlans",
    "usePlan",
    "usePoolCount",
    "usePlansHistory",
]);

const asSortedJson = (keys: unknown[][]): string[] => keys.map((k) => JSON.stringify(k)).sort();

describe("meals mutation cache cascades", () => {
    beforeEach(() => {
        harness.reset();
    });

    it.each(CASCADES.map((c) => [c.name, c] as const))(
        "%s invalidates exactly its documented keys",
        async (_name, cascade) => {
            const mutation = cascade.hook();
            const mutateAsync = mutation.mutateAsync as (variables: unknown) => Promise<unknown>;
            await mutateAsync(cascade.vars);

            const actual = [
                ...harness.invalidatedIn("success"),
                ...harness.invalidatedIn("settled"),
            ].sort();

            expect([...new Set(actual)]).toEqual([...new Set(asSortedJson(cascade.invalidates))]);
        }
    );

    /**
     * `CACHE_KEYS.md` §4 calls this out by name, and it is the cascade most likely to be dropped
     * by someone "tidying up": the recipe *list* carries full ingredient details, so an ingredient
     * edit that only invalidated the recipe detail would leave every card showing stale
     * ingredients. Named separately so the reason survives a future refactor of the table above.
     */
    it.each(["useAddIngredient", "useUpdateIngredient", "useDeleteIngredient"])(
        "%s invalidates the recipe list, not just the recipe detail",
        async (name) => {
            const cascade = CASCADES.find((c) => c.name === name)!;
            const mutation = cascade.hook();
            const mutateAsync = mutation.mutateAsync as (variables: unknown) => Promise<unknown>;
            await mutateAsync(cascade.vars);

            expect(harness.invalidatedIn("success")).toContain(
                JSON.stringify(queryKeys.recipes.byHousehold(HOUSEHOLD))
            );
        }
    );
});

describe("meals cascade coverage", () => {
    it("documents a cascade for every mutation hook", () => {
        const mutationHooks = Object.entries(mealsHooks)
            .filter(([name, value]) => name.startsWith("use") && typeof value === "function")
            .map(([name]) => name)
            .filter((name) => !NON_MUTATION_HOOKS.has(name))
            .sort();

        // Adding a recipe/plan/tag mutation without a row above fails here, exactly as it does for
        // the store hooks in cacheCascade.test.ts.
        expect(mutationHooks).toEqual(CASCADES.map((c) => c.name).sort());
    });
});
