/**
 * Recipe import types and validation for LLM-based recipe extraction
 */

export interface ParsedRecipeIngredient {
    name: string;
    shoppingName?: string | null;
    qty: number | null;
    shoppingQty?: number | null;
    unit: string | null;
    shoppingUnit?: string | null;
    isPantryItem?: boolean;
}

export interface ParsedRecipe {
    name: string;
    source: string | null;
    description: string | null;
    steps: string | null;
    cookingTimeMinutes: number | null;
    ingredients: ParsedRecipeIngredient[];
}

export interface RecipeImportResponse {
    recipe: ParsedRecipe;
}

export function validateRecipeImportResult(data: unknown): data is RecipeImportResponse {
    if (typeof data !== "object" || data === null) return false;

    const root = data as Record<string, unknown>;
    if (typeof root.recipe !== "object" || root.recipe === null) return false;

    const recipe = root.recipe as Record<string, unknown>;

    if (typeof recipe.name !== "string" || recipe.name.trim() === "") return false;
    if (recipe.source !== null && recipe.source !== undefined && typeof recipe.source !== "string")
        return false;
    if (recipe.description !== null && typeof recipe.description !== "string") return false;
    if (recipe.steps !== null && typeof recipe.steps !== "string") return false;
    if (recipe.cookingTimeMinutes !== null && typeof recipe.cookingTimeMinutes !== "number")
        return false;
    if (!Array.isArray(recipe.ingredients)) return false;

    return recipe.ingredients.every((ing: unknown) => {
        if (typeof ing !== "object" || ing === null) return false;
        const i = ing as Record<string, unknown>;
        if (typeof i.name !== "string" || i.name.trim() === "") return false;
        if (i.qty !== null && typeof i.qty !== "number") return false;
        if (i.unit !== null && typeof i.unit !== "string") return false;
        // isPantryItem is optional; if present must be boolean
        if (
            i.shoppingName !== undefined &&
            i.shoppingName !== null &&
            typeof i.shoppingName !== "string"
        )
            return false;
        if (
            i.shoppingQty !== undefined &&
            i.shoppingQty !== null &&
            typeof i.shoppingQty !== "number"
        )
            return false;
        if (
            i.shoppingUnit !== undefined &&
            i.shoppingUnit !== null &&
            typeof i.shoppingUnit !== "string"
        )
            return false;
        if (i.isPantryItem !== undefined && typeof i.isPantryItem !== "boolean") return false;
        return true;
    });
}
