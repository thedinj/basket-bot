import type {
    AddRecipeIngredientRequest,
    AddRecipeToShoppingListRequest,
    AddRecipeToShoppingListResponse,
    CreateRecipeRequest,
    Recipe,
    RecipeIngredient,
    RecipeWithDetails,
    UpdateRecipeIngredientRequest,
    UpdateRecipeRequest,
} from "@basket-bot/core";
import { AuthorizationError, NotFoundError } from "@basket-bot/core";
import * as householdRepo from "../repos/householdRepo";
import * as itemRepo from "../repos/itemRepo";
import * as recipeIngredientRepo from "../repos/recipeIngredientRepo";
import * as recipeRepo from "../repos/recipeRepo";
import * as recipeTagRepo from "../repos/recipeTagRepo";
import * as shoppingListRepo from "../repos/shoppingListRepo";
import { roundFactor } from "../utils/math";

/**
 * Service layer for Recipe operations (recipes, ingredients, tag assignments).
 * Enforces authorization: user must be a member of the recipe's household.
 */

function verifyHouseholdAccess(householdId: string, userId: string): void {
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new AuthorizationError("Access denied");
    }
}

function getOwnedRecipe(householdId: string, recipeId: string): Recipe {
    const recipe = recipeRepo.getRecipeById(recipeId);
    if (!recipe || recipe.householdId !== householdId) {
        throw new NotFoundError("Recipe not found");
    }
    return recipe;
}

function getOwnedRecipeWithDetails(householdId: string, recipeId: string): RecipeWithDetails {
    const recipe = recipeRepo.getRecipeWithDetails(recipeId);
    if (!recipe || recipe.householdId !== householdId) {
        throw new NotFoundError("Recipe not found");
    }
    return recipe;
}

// ========== Recipe CRUD ==========

export function listRecipes(householdId: string, userId: string): RecipeWithDetails[] {
    verifyHouseholdAccess(householdId, userId);
    return recipeRepo.getRecipesWithDetailsByHousehold(householdId);
}

export function getRecipe(
    householdId: string,
    recipeId: string,
    userId: string
): RecipeWithDetails {
    verifyHouseholdAccess(householdId, userId);
    return getOwnedRecipeWithDetails(householdId, recipeId);
}

export function createRecipe(
    householdId: string,
    data: CreateRecipeRequest,
    userId: string
): Recipe {
    verifyHouseholdAccess(householdId, userId);
    return recipeRepo.createRecipe({ householdId, ...data, createdById: userId });
}

export function updateRecipe(
    householdId: string,
    recipeId: string,
    data: UpdateRecipeRequest,
    userId: string
): Recipe | null {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    return recipeRepo.updateRecipe({ id: recipeId, ...data, updatedById: userId });
}

export function deleteRecipe(householdId: string, recipeId: string, userId: string): void {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    recipeRepo.deleteRecipe(recipeId);
}

// ========== Ingredient Operations ==========

export function addIngredient(
    householdId: string,
    recipeId: string,
    data: AddRecipeIngredientRequest,
    userId: string
): RecipeIngredient {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    return recipeIngredientRepo.addIngredient({ recipeId, ...data, createdById: userId });
}

export function updateIngredient(
    householdId: string,
    recipeId: string,
    ingredientId: string,
    data: UpdateRecipeIngredientRequest,
    userId: string
): RecipeIngredient {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    const ingredient = recipeIngredientRepo.updateIngredient({
        id: ingredientId,
        ...data,
        updatedById: userId,
    });
    if (!ingredient) {
        throw new NotFoundError("Ingredient not found");
    }
    return ingredient;
}

export function deleteIngredient(
    householdId: string,
    recipeId: string,
    ingredientId: string,
    userId: string
): void {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    recipeIngredientRepo.deleteIngredient(ingredientId);
}

// ========== Tag Assignment ==========

export function assignTag(
    householdId: string,
    recipeId: string,
    tagId: string,
    userId: string
): RecipeWithDetails {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    recipeTagRepo.assignTagToRecipe(recipeId, tagId);
    return getOwnedRecipeWithDetails(householdId, recipeId);
}

export function removeTag(
    householdId: string,
    recipeId: string,
    tagId: string,
    userId: string
): void {
    verifyHouseholdAccess(householdId, userId);
    getOwnedRecipe(householdId, recipeId);
    recipeTagRepo.removeTagFromRecipe(recipeId, tagId);
}

// ========== Add to Shopping List ==========

export function addRecipeToShoppingList(
    householdId: string,
    recipeId: string,
    data: AddRecipeToShoppingListRequest,
    userId: string
): AddRecipeToShoppingListResponse {
    verifyHouseholdAccess(householdId, userId);
    const recipe = getOwnedRecipeWithDetails(householdId, recipeId);

    // Validates that submitted ingredientIds belong to this recipe — pantry (excluded)
    // ingredients are allowed here since the client explicitly opted them in.
    const ingredientSet = new Set(recipe.ingredients.map((i) => i.id));

    let itemsCreated = 0;
    let itemsSkipped = 0;

    for (const route of data.routes) {
        if (!ingredientSet.has(route.ingredientId)) {
            itemsSkipped++;
            continue;
        }

        const ingredient = recipe.ingredients.find((i) => i.id === route.ingredientId)!;
        const hasShoppingOverride =
            ingredient.shoppingQty !== null || ingredient.shoppingUnitId !== null;
        const effectiveQty = hasShoppingOverride ? ingredient.shoppingQty : ingredient.qty;
        const effectiveUnitId = hasShoppingOverride ? ingredient.shoppingUnitId : ingredient.unitId;
        const scaledQty = effectiveQty != null ? roundFactor(effectiveQty * data.factor) : null;

        const storeItem = itemRepo.getOrCreateStoreItemByName({
            storeId: route.storeId,
            name: ingredient.shoppingName ?? ingredient.name,
            createdById: userId,
        });

        shoppingListRepo.upsertShoppingListItem({
            storeId: route.storeId,
            storeItemId: storeItem.id,
            qty: scaledQty,
            unitId: effectiveUnitId ?? null,
            notes: recipe.name,
            isUnsure: route.isUnsure ?? ingredient.isUnsure ?? null,
            userId,
        });

        itemsCreated++;
    }

    return { itemsCreated, itemsSkipped };
}
