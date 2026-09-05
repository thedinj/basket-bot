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
    /**
     * True when this ingredient shouldn't get its own shopping-list entry — either it's a
     * pantry staple, or its purchase is already covered by another ingredient in the same
     * recipe (see `applyShoppingMap`). Pre-unchecked in the import preview either way.
     */
    excluded: z.boolean().optional(),
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

/**
 * Pass 2 (shopping conversion) response shape: given the ingredient list extracted by
 * pass 1, decide the buy-form fields for each one. Indexed rather than name-matched so
 * the merge is unambiguous even if two ingredients share a name.
 */
export const shoppingMapEntrySchema = z.object({
    index: z.number().int().min(0),
    shoppingName: z.string().nullable().optional(),
    shoppingQty: z.number().nullable().optional(),
    shoppingUnit: z.string().nullable().optional(),
    excluded: z.boolean().optional(),
});

export const shoppingMapResponseSchema = z.object({
    ingredients: z.array(shoppingMapEntrySchema),
});

export type ShoppingMapEntry = z.infer<typeof shoppingMapEntrySchema>;
export type ShoppingMapResponse = z.infer<typeof shoppingMapResponseSchema>;

/**
 * Merges pass 2's shopping-form decisions back onto pass 1's extracted recipe. Falls back
 * to matching by array position if an entry's index is missing or out of range, since a
 * dropped/misnumbered entry shouldn't lose the ingredient's shopping-form data entirely.
 */
export function applyShoppingMap(recipe: ParsedRecipe, map: ShoppingMapResponse): ParsedRecipe {
    const byIndex = new Map<number, ShoppingMapEntry>();
    map.ingredients.forEach((entry, position) => {
        const key =
            Number.isInteger(entry.index) &&
            entry.index >= 0 &&
            entry.index < recipe.ingredients.length
                ? entry.index
                : position;
        byIndex.set(key, entry);
    });

    return {
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient, index) => {
            const entry = byIndex.get(index);
            if (!entry) return ingredient;
            return {
                ...ingredient,
                shoppingName: entry.shoppingName ?? undefined,
                shoppingQty: entry.shoppingQty ?? undefined,
                shoppingUnit: entry.shoppingUnit ?? undefined,
                excluded: entry.excluded ?? false,
            };
        }),
    };
}
