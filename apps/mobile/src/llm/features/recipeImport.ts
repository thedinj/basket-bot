/**
 * Recipe import types and schema for LLM-based recipe extraction
 */

import { z } from "zod";

export const parsedRecipeIngredientSchema = z.object({
    name: z.string().min(1),
    /** Present when the shopping-list form of the ingredient differs from the recipe's. */
    shoppingName: z.string().nullable().optional(),
    qty: z.number().nullable(),
    shoppingQty: z.number().nullable().optional(),
    unit: z.string().nullable(),
    shoppingUnit: z.string().nullable().optional(),
    /** Staples the user probably already owns — pre-unchecked in the import preview. */
    isPantryItem: z.boolean().optional(),
});

export const parsedRecipeSchema = z.object({
    name: z.string().min(1),
    source: z.string().nullable().optional(),
    description: z.string().nullable(),
    steps: z.string().nullable(),
    cookingTimeMinutes: z.number().nullable(),
    ingredients: z.array(parsedRecipeIngredientSchema),
});

export const recipeImportResponseSchema = z.object({
    recipe: parsedRecipeSchema,
});

export type ParsedRecipeIngredient = z.infer<typeof parsedRecipeIngredientSchema>;
export type ParsedRecipe = z.infer<typeof parsedRecipeSchema>;
export type RecipeImportResponse = z.infer<typeof recipeImportResponseSchema>;
