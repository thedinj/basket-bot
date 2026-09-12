import type { AddRecipeToShoppingListRequest, Recipe } from "@basket-bot/core";
import { roundFactor } from "./math";

/**
 * The note stamped on a shopping-list item created from a recipe.
 *
 * A scaled recipe records its multiplier, so the list explains where an unusual quantity
 * came from — "Chicken Parmesan × 2" rather than a doubled amount with nothing to account
 * for it. An unscaled recipe keeps the bare name, since "× 1" is noise.
 *
 * Takes the recipe and the dispatch options as objects rather than loose primitives so that
 * anything else worth recording in the note (a plan date, a slot number) can be threaded
 * through by widening these types, without rewriting either call site's signature. The
 * meal-plan dispatch has only a joined recipe name to hand, hence the narrow `Pick`s.
 */
export function buildRecipeNote(
    recipe: Pick<Recipe, "name">,
    data: Pick<AddRecipeToShoppingListRequest, "factor">
): string {
    const { factor } = data;
    if (!Number.isFinite(factor) || factor === 1) return recipe.name;
    return `${recipe.name} × ${roundFactor(factor)}`;
}
