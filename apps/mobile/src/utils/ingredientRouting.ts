/**
 * Resolving a recipe ingredient to the store it will be bought from, and the quantity that
 * will be ordered once the recipe is scaled.
 *
 * Two screens perform this derivation — the meal plan wizard's routing step and the
 * standalone "route ingredients" modal — and until this module existed they held separate
 * copies of it. That is the same setup that produced the vanishing snoozed-items toggle
 * (see `partitionBySnooze` in `shoppingListDerivations.ts`): two copies of a rule drift,
 * and the screens then disagree about what the user selected. Both now call in here.
 *
 * Two rules live in this file and nowhere else:
 *
 * - **`DEFAULT_STORE` is a sentinel, not a store id.** The routing UI stores it against an
 *   ingredient to mean "wherever the default is", so it must be swapped for the real
 *   default store id before anything downstream treats it as an id. A `null` store means
 *   the ingredient is not being bought and is excluded from the order.
 * - **A scaled quantity is rounded to four significant figures.** Multiplying by a fraction
 *   otherwise yields values like `0.30000000000000004` in the UI and on the shopping list.
 */

export const DEFAULT_STORE = "__default__";

/** An ingredient as it comes off a recipe, before routing decisions are applied. */
export interface RawIngredient {
    id: string;
    recipeId: string;
    name: string;
    recipeName: string;
    qty: number | null;
    unitId: string | null;
    excluded: boolean;
    isUnsure: boolean;
}

/** An ingredient with its destination store and scaled quantity resolved. */
export interface ResolvedIngredient {
    ingredientId: string;
    recipeId: string;
    name: string;
    recipeName: string;
    storeId: string | null;
    qty: number | null;
    scaledQty: number | null;
    unitId: string | null;
    isUnsure: boolean;
    excluded: boolean;
}

/** The routing decisions the user has made, applied to every ingredient. */
export interface IngredientRoutingContext {
    /** Ingredient id → chosen store id, `DEFAULT_STORE`, or null for "not buying". */
    routeMap: Map<string, string | null>;
    /** The store `DEFAULT_STORE` resolves to. Null when the user has no default. */
    defaultStoreId: string | null;
    /** Ingredient ids the user flagged as uncertain. */
    unsureSet: Set<string>;
}

/**
 * Multiply a quantity by a scale factor, rounded to four significant figures.
 *
 * @returns The scaled quantity, or null when the ingredient has no quantity to scale
 */
export const scaleQuantity = (qty: number | null, factor: number): number | null =>
    qty != null ? parseFloat((qty * factor).toPrecision(4)) : null;

/**
 * Resolve the sentinel store value to a real store id.
 *
 * @returns The store to buy from, or null when the ingredient is not being bought
 */
export const resolveStoreId = (
    routed: string | null,
    defaultStoreId: string | null
): string | null => (routed === DEFAULT_STORE ? (defaultStoreId ?? null) : routed);

/**
 * Apply routing and scaling to one ingredient.
 *
 * @param ingredient The raw recipe ingredient
 * @param context The user's routing decisions
 * @param factor The scale factor for this ingredient's recipe
 */
export const resolveIngredient = (
    ingredient: RawIngredient,
    context: IngredientRoutingContext,
    factor: number
): ResolvedIngredient => ({
    ingredientId: ingredient.id,
    recipeId: ingredient.recipeId,
    name: ingredient.name,
    recipeName: ingredient.recipeName,
    storeId: resolveStoreId(context.routeMap.get(ingredient.id) ?? null, context.defaultStoreId),
    qty: ingredient.qty,
    scaledQty: scaleQuantity(ingredient.qty, factor),
    unitId: ingredient.unitId,
    isUnsure: context.unsureSet.has(ingredient.id),
    excluded: ingredient.excluded,
});

/**
 * Apply routing and scaling to a flat list of ingredients sharing one scale factor.
 */
export const resolveIngredients = (
    ingredients: RawIngredient[],
    context: IngredientRoutingContext,
    factor: number
): ResolvedIngredient[] =>
    ingredients.map((ingredient) => resolveIngredient(ingredient, context, factor));

/**
 * How many ingredients will actually be ordered — i.e. have somewhere to be bought from.
 */
export const countRoutedIngredients = (ingredients: ResolvedIngredient[]): number =>
    ingredients.filter((ingredient) => ingredient.storeId !== null).length;
