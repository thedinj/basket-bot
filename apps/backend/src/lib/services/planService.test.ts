import { AuthorizationError, ConflictError, NotFoundError } from "@basket-bot/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    seedHousehold,
    seedHouseholdMember,
    seedIngredient,
    seedPlan,
    seedRecipe,
    seedStore,
    seedTag,
    seedTagAssignment,
    seedUser,
} from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import { db } from "../db/db";
import * as planService from "./planService";

/**
 * `planService` was rewritten wholesale in `ba4225b` and is the sharpest logic in the backend:
 * reroll has to respect pinned slots and avoid handing the same recipe to two slots, and dispatch
 * has to find-or-create a store item per routed ingredient while honouring the "buy this instead"
 * overrides. Both fail quietly — a duplicated recipe or a wrong quantity looks like data, not like
 * a crash — which is exactly the shape of bug a test catches and a user does not report.
 */

let member: string;
let stranger: string;
let householdId: string;

beforeEach(() => {
    resetDb();
    member = seedUser({ name: "Member" });
    stranger = seedUser({ name: "Stranger" });
    householdId = seedHousehold({ ownerId: member });
    seedHouseholdMember({ householdId, userId: member });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("household membership", () => {
    /**
     * Table-driven over the export list rather than one test per function. Every export starts
     * with the same `assertMember` call, and the failure mode of forgetting it on the next export
     * is a member of any household reading and mutating another household's meal plans.
     */
    const callAsStranger: Record<string, () => unknown> = {
        createPlan: () => planService.createPlan({ householdId, userId: stranger }),
        getPlansByHousehold: () => planService.getPlansByHousehold(householdId, stranger),
        getPlanWithDetails: () => planService.getPlanWithDetails(householdId, "p", stranger),
        updatePlan: () => planService.updatePlan(householdId, "p", stranger, { slotCount: 2 }),
        deletePlan: () => planService.deletePlan(householdId, "p", stranger),
        updateSlots: () => planService.updateSlots(householdId, "p", stranger, []),
        rerollSlots: () => planService.rerollSlots(householdId, "p", stranger, [1]),
        updateRoutes: () => planService.updateRoutes(householdId, "p", stranger, []),
        dispatchPlan: () => planService.dispatchPlan(householdId, "p", stranger),
        getPlansHistory: () => planService.getPlansHistory(householdId, stranger, 10, 0),
        getPoolCount: () => planService.getPoolCount(householdId, stranger, []),
    };

    const exported = Object.keys(planService).filter(
        (key) => typeof (planService as Record<string, unknown>)[key] === "function"
    );

    it("covers every exported function", () => {
        expect(Object.keys(callAsStranger).sort()).toEqual(exported.sort());
    });

    it.each(Object.keys(callAsStranger))("%s rejects a non-member", (name) => {
        expect(callAsStranger[name]).toThrow(AuthorizationError);
    });

    it("accepts a second member of the same household", () => {
        const other = seedUser({ name: "Other" });
        seedHouseholdMember({ householdId, userId: other });

        expect(() => planService.getPlansByHousehold(householdId, other)).not.toThrow();
    });
});

describe("plan CRUD", () => {
    it("creates a plan with four slots by default", () => {
        const plan = planService.createPlan({ householdId, userId: member });

        expect(plan.state).toBe("draft");
        expect(plan.slotCount).toBe(4);
        expect(plan.slots.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4]);
        expect(plan.slots.every((s) => s.pickedRecipeId === null && !s.pinned)).toBe(true);
    });

    it("hides a plan belonging to another household", () => {
        const otherHousehold = seedHousehold({ ownerId: stranger, name: "Theirs" });
        const foreignPlan = seedPlan({ householdId: otherHousehold, ownerId: stranger });

        expect(planService.getPlanWithDetails(householdId, foreignPlan, member)).toBeNull();
    });

    it("refuses to edit a plan from another household", () => {
        const otherHousehold = seedHousehold({ ownerId: stranger, name: "Theirs" });
        const foreignPlan = seedPlan({ householdId: otherHousehold, ownerId: stranger });

        expect(() =>
            planService.updatePlan(householdId, foreignPlan, member, { slotCount: 2 })
        ).toThrow(NotFoundError);
    });

    it("grows the slot rows when slotCount increases", () => {
        const planId = seedPlan({ householdId, slotCount: 2, ownerId: member });

        const updated = planService.updatePlan(householdId, planId, member, { slotCount: 5 })!;

        expect(updated.slots.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4, 5]);
    });

    it("drops the extra slot rows when slotCount decreases", () => {
        const planId = seedPlan({ householdId, slotCount: 5, ownerId: member });

        const updated = planService.updatePlan(householdId, planId, member, { slotCount: 2 })!;

        expect(updated.slots.map((s) => s.slotNumber)).toEqual([1, 2]);
    });

    it("leaves the slot rows alone when slotCount is not part of the update", () => {
        const store = seedStore({ ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 3, ownerId: member });

        const updated = planService.updatePlan(householdId, planId, member, {
            defaultStoreId: store,
        })!;

        expect(updated.defaultStoreId).toBe(store);
        expect(updated.slots).toHaveLength(3);
    });

    it("refuses to edit a plan that has been dispatched", () => {
        const planId = seedPlan({ householdId, state: "active", ownerId: member });

        expect(() => planService.updatePlan(householdId, planId, member, { slotCount: 2 })).toThrow(
            ConflictError
        );
        expect(() => planService.updateSlots(householdId, planId, member, [])).toThrow(
            ConflictError
        );
        expect(() => planService.updateRoutes(householdId, planId, member, [])).toThrow(
            ConflictError
        );
    });

    it("refuses to delete an active plan but allows an archived one", () => {
        const active = seedPlan({ householdId, state: "active", ownerId: member });
        const archived = seedPlan({ householdId, state: "archived", ownerId: member });

        expect(() => planService.deletePlan(householdId, active, member)).toThrow(ConflictError);
        expect(planService.deletePlan(householdId, archived, member)).toBe(true);
    });

    it("reports a missing plan as not-deleted rather than throwing", () => {
        expect(planService.deletePlan(householdId, crypto.randomUUID(), member)).toBe(false);
    });
});

describe("rerollSlots", () => {
    /** Make `Math.random` deterministic: always take the first candidate in the pool. */
    const alwaysFirst = () => vi.spyOn(Math, "random").mockReturnValue(0);

    it("does not touch a pinned slot", () => {
        const keeper = seedRecipe({ householdId, name: "Keeper", ownerId: member });
        seedRecipe({ householdId, name: "Other", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 2, ownerId: member });
        planService.updateSlots(householdId, planId, member, [
            { slotNumber: 1, tagIds: [], pickedRecipeId: keeper, pinned: true },
            { slotNumber: 2, tagIds: [] },
        ]);
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [1, 2])!;

        expect(plan.slots.find((s) => s.slotNumber === 1)!.pickedRecipeId).toBe(keeper);
    });

    /**
     * The reserved-id rule. A recipe pinned in a slot we are *not* rerolling must stay out of the
     * pool, or a reroll happily serves the same dinner twice in one week.
     */
    it("excludes recipes pinned in slots that are not being rerolled", () => {
        const pinned = seedRecipe({ householdId, name: "A Pinned", ownerId: member });
        const free = seedRecipe({ householdId, name: "B Free", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 2, ownerId: member });
        planService.updateSlots(householdId, planId, member, [
            { slotNumber: 1, tagIds: [], pickedRecipeId: pinned, pinned: true },
            { slotNumber: 2, tagIds: [] },
        ]);
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [2])!;

        expect(plan.slots.find((s) => s.slotNumber === 2)!.pickedRecipeId).toBe(free);
    });

    it("does not give the same recipe to two slots in one reroll", () => {
        seedRecipe({ householdId, name: "A", ownerId: member });
        seedRecipe({ householdId, name: "B", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 2, ownerId: member });
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [1, 2])!;

        const picks = plan.slots.map((s) => s.pickedRecipeId);
        expect(picks.filter(Boolean)).toHaveLength(2);
        expect(new Set(picks).size).toBe(2);
    });

    it("clears the pick when the pool is smaller than the number of slots", () => {
        seedRecipe({ householdId, name: "Only", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 3, ownerId: member });
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [1, 2, 3])!;

        expect(plan.slots.map((s) => s.pickedRecipeId).filter(Boolean)).toHaveLength(1);
    });

    it("honours a slot's tag intent", () => {
        const tag = seedTag({ householdId, name: "Quick", ownerId: member });
        const tagged = seedRecipe({ householdId, name: "Tagged", ownerId: member });
        seedTagAssignment({ recipeId: tagged, tagId: tag });
        seedRecipe({ householdId, name: "Untagged", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 1, ownerId: member });
        planService.updateSlots(householdId, planId, member, [{ slotNumber: 1, tagIds: [tag] }]);
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [1])!;

        expect(plan.slots[0].pickedRecipeId).toBe(tagged);
    });

    it("honours a slot's cooking-time ceiling", () => {
        const quick = seedRecipe({
            householdId,
            name: "Quick",
            cookingTimeMinutes: 15,
            ownerId: member,
        });
        seedRecipe({ householdId, name: "Slow", cookingTimeMinutes: 90, ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 1, ownerId: member });
        planService.updateSlots(householdId, planId, member, [
            { slotNumber: 1, tagIds: [], maxCookingTimeMinutes: 30 },
        ]);
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [1])!;

        expect(plan.slots[0].pickedRecipeId).toBe(quick);
    });

    /**
     * The reason `rerollSlots` sorts by pool size before picking. The constrained slot has exactly
     * one candidate; if the unconstrained slot picked first it could take that recipe and leave
     * the constrained slot empty. Smallest-pool-first means both get filled.
     */
    it("fills the most constrained slot first", () => {
        const tag = seedTag({ householdId, name: "Only", ownerId: member });
        const tagged = seedRecipe({ householdId, name: "A Tagged", ownerId: member });
        seedTagAssignment({ recipeId: tagged, tagId: tag });
        seedRecipe({ householdId, name: "B Free", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 2, ownerId: member });
        planService.updateSlots(householdId, planId, member, [
            // Slot 1 is unconstrained and would otherwise pick "A Tagged" first (alphabetical).
            { slotNumber: 1, tagIds: [] },
            { slotNumber: 2, tagIds: [tag] },
        ]);
        alwaysFirst();

        const plan = planService.rerollSlots(householdId, planId, member, [1, 2])!;

        expect(plan.slots.find((s) => s.slotNumber === 2)!.pickedRecipeId).toBe(tagged);
        expect(plan.slots.find((s) => s.slotNumber === 1)!.pickedRecipeId).not.toBeNull();
    });

    it("ignores slot numbers that do not exist", () => {
        seedRecipe({ householdId, name: "A", ownerId: member });
        const planId = seedPlan({ householdId, slotCount: 1, ownerId: member });
        alwaysFirst();

        expect(() => planService.rerollSlots(householdId, planId, member, [99])).not.toThrow();
    });

    it("refuses to reroll a dispatched plan", () => {
        const planId = seedPlan({ householdId, state: "active", ownerId: member });

        expect(() => planService.rerollSlots(householdId, planId, member, [1])).toThrow(
            ConflictError
        );
    });
});

describe("dispatchPlan", () => {
    type IngredientOverrides = Omit<Parameters<typeof seedIngredient>[0], "recipeId" | "ownerId">;

    const setupRoutedPlan = (options: {
        storeId: string | null;
        ingredient?: IngredientOverrides;
        isUnsure?: boolean | null;
    }) => {
        const recipeId = seedRecipe({ householdId, name: "Soup", ownerId: member });
        const ingredientId = seedIngredient({
            recipeId,
            name: "Carrot",
            qty: 2,
            ownerId: member,
            ...options.ingredient,
        });
        const planId = seedPlan({ householdId, ownerId: member });
        planService.updateRoutes(householdId, planId, member, [
            { ingredientId, storeId: options.storeId, isUnsure: options.isUnsure ?? null },
        ]);
        return { planId, ingredientId, recipeId };
    };

    const listRows = (storeId: string) =>
        db
            .prepare(
                `SELECT sli.qty, sli.unitId, sli.notes, sli.isUnsure, si.name AS itemName
                 FROM ShoppingListItem sli
                 LEFT JOIN StoreItem si ON si.id = sli.storeItemId
                 WHERE sli.storeId = ?`
            )
            .all(storeId) as Array<{
            qty: number | null;
            unitId: string | null;
            notes: string | null;
            isUnsure: number | null;
            itemName: string | null;
        }>;

    it("adds each routed ingredient to its store list and flips the plan to active", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({ storeId });

        const result = planService.dispatchPlan(householdId, planId, member);

        expect(result.itemsAdded).toBe(1);
        expect(result.itemsSkipped).toBe(0);
        expect(result.plan.state).toBe("active");
        expect(result.plan.dispatchedAt).not.toBeNull();
        expect(listRows(storeId)).toEqual([
            { qty: 2, unitId: null, notes: "Soup", isUnsure: null, itemName: "Carrot" },
        ]);
    });

    it("skips an ingredient with no store routed", () => {
        const { planId } = setupRoutedPlan({ storeId: null });

        const result = planService.dispatchPlan(householdId, planId, member);

        expect(result).toMatchObject({ itemsAdded: 0, itemsSkipped: 1 });
    });

    it("skips a route whose ingredient has been deleted", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId, ingredientId } = setupRoutedPlan({ storeId });
        // The route row survives the ingredient only because foreign keys are enforced at the
        // connection level; delete it the way a cascade would leave things mid-flight.
        db.pragma("foreign_keys = OFF");
        db.prepare(`DELETE FROM RecipeIngredient WHERE id = ?`).run(ingredientId);
        db.pragma("foreign_keys = ON");

        const result = planService.dispatchPlan(householdId, planId, member);

        expect(result).toMatchObject({ itemsAdded: 0, itemsSkipped: 1 });
    });

    it("scales the quantity by the recipe's factor", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId, recipeId } = setupRoutedPlan({ storeId });

        planService.dispatchPlan(householdId, planId, member, { [recipeId]: 1.5 });

        expect(listRows(storeId)[0].qty).toBe(3);
    });

    it("leaves a null quantity null however it is scaled", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId, recipeId } = setupRoutedPlan({
            storeId,
            ingredient: { qty: null },
        });

        planService.dispatchPlan(householdId, planId, member, { [recipeId]: 3 });

        expect(listRows(storeId)[0].qty).toBeNull();
    });

    /**
     * `shoppingQty`/`shoppingUnitId` are the "the recipe wants 3 cloves, buy a whole bulb"
     * override. Either one being set switches *both* to the shopping values — reading them
     * independently would combine a shopping quantity with a recipe unit.
     */
    it("prefers the shopping override for both quantity and unit together", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({
            storeId,
            ingredient: {
                qty: 3,
                unitId: "gram",
                shoppingQty: 1,
                shoppingUnitId: "kilogram",
            },
        });

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0]).toMatchObject({ qty: 1, unitId: "kilogram" });
    });

    it("falls back to the recipe unit when only the shopping quantity is overridden", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({
            storeId,
            ingredient: { qty: 3, unitId: "gram", shoppingQty: 500 },
        });

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0]).toMatchObject({ qty: 500, unitId: null });
    });

    it("shops for the shoppingName when the ingredient has one", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({
            storeId,
            ingredient: { name: "Garlic clove", shoppingName: "Garlic bulb" },
        });

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0].itemName).toBe("Garlic bulb");
    });

    it("reuses an existing store item rather than creating a duplicate", () => {
        const storeId = seedStore({ ownerId: member });
        const recipeId = seedRecipe({ householdId, name: "Soup", ownerId: member });
        // Same name in two recipes' worth of routes, differing only in case and spacing.
        const a = seedIngredient({ recipeId, name: "Carrot", qty: 1, ownerId: member });
        const b = seedIngredient({ recipeId, name: "  CARROT ", qty: 2, ownerId: member });
        const planId = seedPlan({ householdId, ownerId: member });
        planService.updateRoutes(householdId, planId, member, [
            { ingredientId: a, storeId },
            { ingredientId: b, storeId },
        ]);

        const result = planService.dispatchPlan(householdId, planId, member);

        expect(result.itemsAdded).toBe(2);
        const items = db
            .prepare(`SELECT id FROM StoreItem WHERE storeId = ?`)
            .all(storeId) as unknown[];
        expect(items).toHaveLength(1);
    });

    it("marks the list item unsure when the route says so", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({ storeId, isUnsure: true });

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0].isUnsure).toBe(1);
    });

    /**
     * The regression this suite was written for. The routing screen seeds the unsure box from the
     * ingredient and then lets the user change it, and it reads a stored NULL as "no" — so an
     * unticked box looks accepted on screen. `dispatchPlan` used to read the same NULL as "unset,
     * ask the ingredient", quietly re-marking the item unsure on the list the user was shown.
     * The route is now the last word.
     */
    it("respects a route that says not-unsure even when the ingredient is", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({
            storeId,
            ingredient: { isUnsure: true },
            isUnsure: false,
        });

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0].isUnsure).toBeNull();
    });

    /**
     * Same path with no explicit route value at all. A route row can only exist because the user
     * completed the routing screen, so "nothing was said" and "the user said no" are the same
     * answer here — and neither is a reason to reinstate the ingredient's flag.
     */
    it("does not inherit the ingredient's isUnsure when the route omits it", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({ storeId, ingredient: { isUnsure: true } });

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0].isUnsure).toBeNull();
    });

    /**
     * The ordering that made the old behaviour reachable: routes are saved at step 3 and the
     * recipe can be edited afterwards. A later edit to the recipe must not reach back and change
     * what the user already signed off on.
     */
    it("is not affected by the ingredient being marked unsure after routing", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId, ingredientId } = setupRoutedPlan({ storeId, isUnsure: false });
        db.prepare(`UPDATE RecipeIngredient SET isUnsure = 1 WHERE id = ?`).run(ingredientId);

        planService.dispatchPlan(householdId, planId, member);

        expect(listRows(storeId)[0].isUnsure).toBeNull();
    });

    /** The real protection against a double dispatch: the plan is no longer a draft. */
    it("refuses a second dispatch", () => {
        const storeId = seedStore({ ownerId: member });
        const { planId } = setupRoutedPlan({ storeId });
        planService.dispatchPlan(householdId, planId, member);

        expect(() => planService.dispatchPlan(householdId, planId, member)).toThrow(ConflictError);
        expect(listRows(storeId)).toHaveLength(1);
    });
});

describe("getPoolCount", () => {
    it("counts only recipes eligible for the pool", () => {
        seedRecipe({ householdId, name: "Eligible", ownerId: member });
        seedRecipe({ householdId, name: "Hidden", isHidden: true, ownerId: member });
        seedRecipe({ householdId, name: "Excluded", isPoolExcluded: true, ownerId: member });

        expect(planService.getPoolCount(householdId, member, [])).toBe(1);
    });

    it("narrows by tag and cooking time", () => {
        const tag = seedTag({ householdId, name: "Quick", ownerId: member });
        const quick = seedRecipe({
            householdId,
            name: "Quick",
            cookingTimeMinutes: 10,
            ownerId: member,
        });
        seedTagAssignment({ recipeId: quick, tagId: tag });
        const slow = seedRecipe({
            householdId,
            name: "Slow",
            cookingTimeMinutes: 120,
            ownerId: member,
        });
        seedTagAssignment({ recipeId: slow, tagId: tag });

        expect(planService.getPoolCount(householdId, member, [tag])).toBe(2);
        expect(planService.getPoolCount(householdId, member, [tag], 30)).toBe(1);
    });
});
