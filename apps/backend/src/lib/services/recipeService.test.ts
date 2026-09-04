import { AuthorizationError, NotFoundError } from "@basket-bot/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
    seedHousehold,
    seedHouseholdMember,
    seedIngredient,
    seedRecipe,
    seedStore,
    seedTag,
    seedTagAssignment,
    seedUser,
} from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import { db } from "../db/db";
import * as recipeService from "./recipeService";

/**
 * Two guards run on nearly every export here and they are not the same guard:
 * `verifyHouseholdAccess` asks "are you in this household at all", and `getOwnedRecipe` asks
 * "does this recipe belong to it". Only the second stops a member of household A from editing a
 * recipe in household B by passing B's recipe id with A's household id — the shape of bug that
 * looks like it works right up until two households exist.
 */

/** `AddRecipeIngredientRequest` carries zod defaults, so both are required once parsed. */
const ingredientRequest = { name: "X", sortOrder: 0, excluded: false };

let member: string;
let stranger: string;
let householdId: string;
let recipeId: string;

beforeEach(() => {
    resetDb();
    member = seedUser({ name: "Member" });
    stranger = seedUser({ name: "Stranger" });
    householdId = seedHousehold({ ownerId: member });
    seedHouseholdMember({ householdId, userId: member });
    recipeId = seedRecipe({ householdId, name: "Soup", ownerId: member });
});

describe("household membership", () => {
    const callAsStranger: Record<string, () => unknown> = {
        listRecipes: () => recipeService.listRecipes(householdId, stranger),
        getRecipe: () => recipeService.getRecipe(householdId, recipeId, stranger),
        createRecipe: () => recipeService.createRecipe(householdId, { name: "X" }, stranger),
        updateRecipe: () => recipeService.updateRecipe(householdId, recipeId, {}, stranger),
        deleteRecipe: () => recipeService.deleteRecipe(householdId, recipeId, stranger),
        addIngredient: () =>
            recipeService.addIngredient(householdId, recipeId, ingredientRequest, stranger),
        updateIngredient: () =>
            recipeService.updateIngredient(householdId, recipeId, "i", {}, stranger),
        deleteIngredient: () =>
            recipeService.deleteIngredient(householdId, recipeId, "i", stranger),
        assignTag: () => recipeService.assignTag(householdId, recipeId, "t", stranger),
        removeTag: () => recipeService.removeTag(householdId, recipeId, "t", stranger),
        addRecipeToShoppingList: () =>
            recipeService.addRecipeToShoppingList(
                householdId,
                recipeId,
                { factor: 1, routes: [] },
                stranger
            ),
    };

    const exported = Object.keys(recipeService).filter(
        (key) => typeof (recipeService as Record<string, unknown>)[key] === "function"
    );

    it("covers every exported function", () => {
        expect(Object.keys(callAsStranger).sort()).toEqual(exported.sort());
    });

    it.each(Object.keys(callAsStranger))("%s rejects a non-member", (name) => {
        expect(callAsStranger[name]).toThrow(AuthorizationError);
    });
});

describe("recipe ownership", () => {
    /**
     * The second guard, run for a user who *is* a legitimate member of the household they name.
     * Every entry passes a recipe that belongs to someone else, so a new export that calls
     * `verifyHouseholdAccess` but forgets `getOwnedRecipe` fails here.
     */
    let foreignRecipe: string;

    const callWithForeignRecipe: Record<string, (id: string) => unknown> = {
        getRecipe: (id) => recipeService.getRecipe(householdId, id, member),
        updateRecipe: (id) => recipeService.updateRecipe(householdId, id, { name: "X" }, member),
        deleteRecipe: (id) => recipeService.deleteRecipe(householdId, id, member),
        addIngredient: (id) =>
            recipeService.addIngredient(householdId, id, ingredientRequest, member),
        updateIngredient: (id) => recipeService.updateIngredient(householdId, id, "i", {}, member),
        deleteIngredient: (id) => recipeService.deleteIngredient(householdId, id, "i", member),
        assignTag: (id) => recipeService.assignTag(householdId, id, "t", member),
        removeTag: (id) => recipeService.removeTag(householdId, id, "t", member),
        addRecipeToShoppingList: (id) =>
            recipeService.addRecipeToShoppingList(
                householdId,
                id,
                { factor: 1, routes: [] },
                member
            ),
    };

    beforeEach(() => {
        const otherHousehold = seedHousehold({ ownerId: stranger, name: "Theirs" });
        foreignRecipe = seedRecipe({
            householdId: otherHousehold,
            name: "Theirs",
            ownerId: stranger,
        });
    });

    it.each(Object.keys(callWithForeignRecipe))(
        "%s refuses a recipe from another household",
        (name) => {
            expect(() => callWithForeignRecipe[name](foreignRecipe)).toThrow(NotFoundError);
        }
    );

    it.each(Object.keys(callWithForeignRecipe))(
        "%s refuses a recipe that does not exist",
        (name) => {
            expect(() => callWithForeignRecipe[name](crypto.randomUUID())).toThrow(NotFoundError);
        }
    );
});

describe("recipe CRUD", () => {
    it("lists only the household's own recipes", () => {
        const otherHousehold = seedHousehold({ ownerId: stranger, name: "Theirs" });
        seedRecipe({ householdId: otherHousehold, name: "Theirs", ownerId: stranger });

        expect(recipeService.listRecipes(householdId, member).map((r) => r.name)).toEqual(["Soup"]);
    });

    it("returns a recipe with its ingredients and tags", () => {
        const tag = seedTag({ householdId, name: "Quick", ownerId: member });
        seedTagAssignment({ recipeId, tagId: tag });
        seedIngredient({ recipeId, name: "Carrot", ownerId: member });

        const recipe = recipeService.getRecipe(householdId, recipeId, member);

        expect(recipe.ingredients.map((i) => i.name)).toEqual(["Carrot"]);
        expect(recipe.tags.map((t) => t.name)).toEqual(["Quick"]);
    });

    it("creates a recipe into the caller's household, not one they name in the payload", () => {
        const created = recipeService.createRecipe(householdId, { name: "Stew" }, member);

        expect(created.householdId).toBe(householdId);
        expect(created.createdById).toBe(member);
    });

    it("deletes a recipe and its ingredients", () => {
        const ingredient = seedIngredient({ recipeId, name: "Carrot", ownerId: member });

        recipeService.deleteRecipe(householdId, recipeId, member);

        expect(db.prepare(`SELECT id FROM Recipe WHERE id = ?`).get(recipeId)).toBeUndefined();
        expect(
            db.prepare(`SELECT id FROM RecipeIngredient WHERE id = ?`).get(ingredient)
        ).toBeUndefined();
    });
});

describe("ingredients", () => {
    it("reports a missing ingredient as not-found rather than returning null", () => {
        expect(() =>
            recipeService.updateIngredient(
                householdId,
                recipeId,
                crypto.randomUUID(),
                { name: "X" },
                member
            )
        ).toThrow(NotFoundError);
    });

    it("adds an ingredient against the recipe it was asked for", () => {
        const added = recipeService.addIngredient(
            householdId,
            recipeId,
            { ...ingredientRequest, name: "Carrot", qty: 2 },
            member
        );

        expect(added).toMatchObject({ recipeId, name: "Carrot", qty: 2 });
    });
});

describe("tag assignment", () => {
    it("assigns and removes a tag, returning the updated recipe", () => {
        const tag = seedTag({ householdId, name: "Quick", ownerId: member });

        const assigned = recipeService.assignTag(householdId, recipeId, tag, member);
        expect(assigned.tags.map((t) => t.id)).toEqual([tag]);

        recipeService.removeTag(householdId, recipeId, tag, member);
        expect(recipeService.getRecipe(householdId, recipeId, member).tags).toEqual([]);
    });
});

describe("addRecipeToShoppingList", () => {
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

    it("adds a routed ingredient, tagging the list note with the recipe name", () => {
        const storeId = seedStore({ ownerId: member });
        const ingredientId = seedIngredient({ recipeId, name: "Carrot", qty: 2, ownerId: member });

        const result = recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId, storeId }] },
            member
        );

        expect(result).toEqual({ itemsCreated: 1, itemsSkipped: 0 });
        expect(listRows(storeId)).toEqual([
            { qty: 2, unitId: null, notes: "Soup", isUnsure: null, itemName: "Carrot" },
        ]);
    });

    /**
     * The check that stops a caller adding *someone else's* ingredient to their own list by
     * passing a foreign ingredient id alongside a recipe they legitimately own.
     */
    it("skips an ingredient that does not belong to the recipe", () => {
        const storeId = seedStore({ ownerId: member });
        const otherRecipe = seedRecipe({ householdId, name: "Stew", ownerId: member });
        const foreignIngredient = seedIngredient({
            recipeId: otherRecipe,
            name: "Beef",
            ownerId: member,
        });

        const result = recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId: foreignIngredient, storeId }] },
            member
        );

        expect(result).toEqual({ itemsCreated: 0, itemsSkipped: 1 });
        expect(listRows(storeId)).toEqual([]);
    });

    /**
     * Excluded ("pantry") ingredients are filtered out of the picker in the UI, but the service
     * still honours them when the client sends one — the user has explicitly opted it back in.
     */
    it("accepts an excluded ingredient the client explicitly routed", () => {
        const storeId = seedStore({ ownerId: member });
        const ingredientId = seedIngredient({
            recipeId,
            name: "Salt",
            excluded: true,
            ownerId: member,
        });

        const result = recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId, storeId }] },
            member
        );

        expect(result).toEqual({ itemsCreated: 1, itemsSkipped: 0 });
    });

    it("scales quantities and rounds to four significant figures", () => {
        const storeId = seedStore({ ownerId: member });
        const ingredientId = seedIngredient({ recipeId, name: "Flour", qty: 1, ownerId: member });

        recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 0.3333, routes: [{ ingredientId, storeId }] },
            member
        );

        expect(listRows(storeId)[0].qty).toBe(0.3333);
    });

    it("prefers the shopping override for quantity and unit together", () => {
        const storeId = seedStore({ ownerId: member });
        const ingredientId = seedIngredient({
            recipeId,
            name: "Garlic",
            qty: 3,
            unitId: "gram",
            shoppingQty: 1,
            shoppingUnitId: "kilogram",
            ownerId: member,
        });

        recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId, storeId }] },
            member
        );

        expect(listRows(storeId)[0]).toMatchObject({ qty: 1, unitId: "kilogram" });
    });

    it("shops for the shoppingName when the ingredient has one", () => {
        const storeId = seedStore({ ownerId: member });
        const ingredientId = seedIngredient({
            recipeId,
            name: "Garlic clove",
            shoppingName: "Garlic bulb",
            ownerId: member,
        });

        recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId, storeId }] },
            member
        );

        expect(listRows(storeId)[0].itemName).toBe("Garlic bulb");
    });

    it("routes ingredients of one recipe to different stores", () => {
        const storeA = seedStore({ ownerId: member, name: "A" });
        const storeB = seedStore({ ownerId: member, name: "B" });
        const carrot = seedIngredient({ recipeId, name: "Carrot", ownerId: member });
        const beef = seedIngredient({ recipeId, name: "Beef", ownerId: member });

        recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            {
                factor: 1,
                routes: [
                    { ingredientId: carrot, storeId: storeA },
                    { ingredientId: beef, storeId: storeB },
                ],
            },
            member
        );

        expect(listRows(storeA).map((r) => r.itemName)).toEqual(["Carrot"]);
        expect(listRows(storeB).map((r) => r.itemName)).toEqual(["Beef"]);
    });

    it("reuses an existing store item for a name that differs only by case", () => {
        const storeId = seedStore({ ownerId: member });
        const ingredientId = seedIngredient({ recipeId, name: "CARROT", ownerId: member });
        // A store item the user already has, written the way the app normalizes it.
        recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId, storeId }] },
            member
        );
        const lower = seedIngredient({ recipeId, name: "carrot", ownerId: member });

        recipeService.addRecipeToShoppingList(
            householdId,
            recipeId,
            { factor: 1, routes: [{ ingredientId: lower, storeId }] },
            member
        );

        const items = db
            .prepare(`SELECT id FROM StoreItem WHERE storeId = ?`)
            .all(storeId) as unknown[];
        expect(items).toHaveLength(1);
    });
});
