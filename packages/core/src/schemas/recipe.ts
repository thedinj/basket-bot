import { z } from "zod";
import {
    MAX_RECIPE_DESCRIPTION_LENGTH,
    MAX_RECIPE_INGREDIENT_NAME_LENGTH,
    MAX_RECIPE_INGREDIENT_NOTES_LENGTH,
    MAX_RECIPE_NAME_LENGTH,
    MAX_RECIPE_SOURCE_LENGTH,
    MAX_RECIPE_SOURCE_URL_LENGTH,
    MAX_RECIPE_STEPS_LENGTH,
    MAX_RECIPE_TAG_NAME_LENGTH,
    TAG_PALETTE_KEYS,
} from "../constants/index.js";
import { maxLengthString, minMaxLengthString } from "./zodHelpers.js";

// ========== Shared Fields ==========
// Audit fields used across recipe schemas
const auditFields = {
    createdById: z.string().uuid(),
    updatedById: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
};

// Audit fields for tag (no updatedById/updatedAt - tags are simple, create-only)
const tagAuditFields = {
    createdById: z.string().uuid(),
    createdAt: z.string().datetime(),
};

// ========== Recipe ==========
export const recipeSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    name: minMaxLengthString(1, MAX_RECIPE_NAME_LENGTH, "Name"),
    description: maxLengthString(MAX_RECIPE_DESCRIPTION_LENGTH, "Description").nullable(),
    steps: maxLengthString(MAX_RECIPE_STEPS_LENGTH, "Steps").nullable(),
    source: maxLengthString(MAX_RECIPE_SOURCE_LENGTH, "Source").nullable(),
    sourceUrl: maxLengthString(MAX_RECIPE_SOURCE_URL_LENGTH, "Source URL").nullable(),
    isHidden: z.boolean(),
    isPoolExcluded: z.boolean(),
    cookingTimeMinutes: z.number().int().min(1).nullable(),
    ...auditFields,
});

export type Recipe = z.infer<typeof recipeSchema>;

export const createRecipeRequestSchema = z.object({
    name: minMaxLengthString(1, MAX_RECIPE_NAME_LENGTH, "Name"),
    source: maxLengthString(MAX_RECIPE_SOURCE_LENGTH, "Source").nullable().optional(),
    description: maxLengthString(MAX_RECIPE_DESCRIPTION_LENGTH, "Description")
        .nullable()
        .optional(),
    steps: maxLengthString(MAX_RECIPE_STEPS_LENGTH, "Steps").nullable().optional(),
    sourceUrl: maxLengthString(MAX_RECIPE_SOURCE_URL_LENGTH, "Source URL").nullable().optional(),
    isPoolExcluded: z.boolean().optional(),
    cookingTimeMinutes: z.number().int().min(1).nullable().optional(),
});

export type CreateRecipeRequest = z.infer<typeof createRecipeRequestSchema>;

export const updateRecipeRequestSchema = createRecipeRequestSchema.partial();

export type UpdateRecipeRequest = z.infer<typeof updateRecipeRequestSchema>;

// ========== RecipeTag ==========
export const recipeTagSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    name: minMaxLengthString(1, MAX_RECIPE_TAG_NAME_LENGTH, "Tag name"),
    colorKey: z.enum(TAG_PALETTE_KEYS).nullable(),
    ...tagAuditFields,
});

export type RecipeTag = z.infer<typeof recipeTagSchema>;

export const createRecipeTagRequestSchema = z.object({
    name: minMaxLengthString(1, MAX_RECIPE_TAG_NAME_LENGTH, "Tag name"),
    colorKey: z.enum(TAG_PALETTE_KEYS).nullable().optional(),
});

export type CreateRecipeTagRequest = z.infer<typeof createRecipeTagRequestSchema>;

export const updateRecipeTagRequestSchema = createRecipeTagRequestSchema.partial();

export type UpdateRecipeTagRequest = z.infer<typeof updateRecipeTagRequestSchema>;

// ========== RecipeTagAssignment ==========
export const recipeTagAssignmentSchema = z.object({
    id: z.string().uuid(),
    recipeId: z.string().uuid(),
    tagId: z.string().uuid(),
    createdAt: z.string().datetime(),
});

export type RecipeTagAssignment = z.infer<typeof recipeTagAssignmentSchema>;

export const assignTagToRecipeRequestSchema = z.object({
    tagId: z.string().uuid(),
});

export type AssignTagToRecipeRequest = z.infer<typeof assignTagToRecipeRequestSchema>;

// ========== RecipeIngredient ==========
export const recipeIngredientSchema = z.object({
    id: z.string().uuid(),
    recipeId: z.string().uuid(),
    name: minMaxLengthString(1, MAX_RECIPE_INGREDIENT_NAME_LENGTH, "Ingredient name"),
    shoppingName: maxLengthString(MAX_RECIPE_INGREDIENT_NAME_LENGTH, "Shopping name").nullable(),
    qty: z.number().nullable(),
    shoppingQty: z.number().nullable(),
    unitId: z.string().nullable(),
    shoppingUnitId: z.string().nullable(),
    sortOrder: z.number().int().min(0),
    notes: maxLengthString(MAX_RECIPE_INGREDIENT_NOTES_LENGTH, "Ingredient notes").nullable(),
    excluded: z.boolean(),
    ...auditFields,
});

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const addRecipeIngredientRequestSchema = z.object({
    name: minMaxLengthString(1, MAX_RECIPE_INGREDIENT_NAME_LENGTH, "Ingredient name"),
    shoppingName: maxLengthString(MAX_RECIPE_INGREDIENT_NAME_LENGTH, "Shopping name").nullable().optional(),
    qty: z.number().nullable().optional(),
    shoppingQty: z.number().nullable().optional(),
    unitId: z.string().nullable().optional(),
    shoppingUnitId: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).optional().default(0),
    notes: maxLengthString(MAX_RECIPE_INGREDIENT_NOTES_LENGTH, "Ingredient notes")
        .nullable()
        .optional(),
    excluded: z.boolean().optional().default(false),
});

export type AddRecipeIngredientRequest = z.infer<typeof addRecipeIngredientRequestSchema>;

export const updateRecipeIngredientRequestSchema = addRecipeIngredientRequestSchema.partial();

export type UpdateRecipeIngredientRequest = z.infer<typeof updateRecipeIngredientRequestSchema>;

export const reorderRecipeIngredientsRequestSchema = z.object({
    updates: z.array(
        z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
        })
    ),
});

export type ReorderRecipeIngredientsRequest = z.infer<typeof reorderRecipeIngredientsRequestSchema>;

// ========== Recipe with Details ==========
// Recipe with joined tags and ingredients
export const recipeWithDetailsSchema = recipeSchema.extend({
    tags: z.array(recipeTagSchema),
    ingredients: z.array(recipeIngredientSchema),
});

export type RecipeWithDetails = z.infer<typeof recipeWithDetailsSchema>;

// ========== Add Recipe to Shopping List ==========
export const addRecipeToShoppingListRequestSchema = z.object({
    factor: z.number().min(0.01).max(100).optional().default(1),
    routes: z
        .array(
            z.object({
                ingredientId: z.string().uuid(),
                storeId: z.string().uuid(),
            })
        )
        .min(1, "At least one ingredient route must be provided"),
});

export type AddRecipeToShoppingListRequest = z.infer<typeof addRecipeToShoppingListRequestSchema>;

export const addRecipeToShoppingListResponseSchema = z.object({
    itemsCreated: z.number().int().min(0),
    itemsSkipped: z.number().int().min(0),
});

export type AddRecipeToShoppingListResponse = z.infer<typeof addRecipeToShoppingListResponseSchema>;
