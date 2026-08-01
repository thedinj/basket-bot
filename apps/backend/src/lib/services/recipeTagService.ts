import type { CreateRecipeTagRequest, RecipeTag, UpdateRecipeTagRequest } from "@basket-bot/core";
import { AuthorizationError, NotFoundError } from "@basket-bot/core";
import * as householdRepo from "../repos/householdRepo";
import * as recipeTagRepo from "../repos/recipeTagRepo";

/**
 * Service layer for household-scoped RecipeTag CRUD.
 * Enforces authorization: user must be a member of the tag's household.
 */

function verifyHouseholdAccess(householdId: string, userId: string): void {
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new AuthorizationError("Access denied");
    }
}

export function listTags(householdId: string, userId: string): RecipeTag[] {
    verifyHouseholdAccess(householdId, userId);
    return recipeTagRepo.getTagsByHousehold(householdId);
}

export function createTag(
    householdId: string,
    data: CreateRecipeTagRequest,
    userId: string
): RecipeTag {
    verifyHouseholdAccess(householdId, userId);
    return recipeTagRepo.createTag({ householdId, ...data, createdById: userId });
}

export function updateTag(
    householdId: string,
    tagId: string,
    data: UpdateRecipeTagRequest,
    userId: string
): RecipeTag {
    verifyHouseholdAccess(householdId, userId);
    const tag = recipeTagRepo.updateTag({ id: tagId, ...data });
    if (!tag) {
        throw new NotFoundError("Tag not found");
    }
    return tag;
}

export function deleteTag(householdId: string, tagId: string, userId: string): void {
    verifyHouseholdAccess(householdId, userId);
    recipeTagRepo.deleteTag(tagId);
}
