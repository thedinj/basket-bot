import type { RecipeWithDetails } from "@basket-bot/core";
import { formatQuantityWithUnit } from "./quantity";

// "1.", "2)", "Step 3:", "4 -" and bullet marks at the start of a line. Imported and pasted
// recipes often number their own steps; the view numbers them itself, so a kept marker would
// read "1. 1. Preheat". The mark must be followed by a space, so "1.5 cups" and "2-3 minutes"
// keep their numbers.
const STEP_MARKER = /^(?:(?:step\s*)?\d+\s*[.):-]|[-*•])\s+/i;

/**
 * A recipe's steps as the list the view numbers: one step per non-blank line, with any
 * numbering or bullet the text brought along removed. Text with a single line comes back as
 * one step, which the view shows as a plain paragraph.
 */
export const splitRecipeSteps = (steps: string | null | undefined): string[] =>
    (steps ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim().replace(STEP_MARKER, "").trim())
        .filter(Boolean);

/** The amount column of an ingredient row: "1.5 cup", "3", "pinch", or "". */
export const formatIngredientAmount = (
    qty: number | null,
    unitId: string | null | undefined,
    unitMap: Map<string, string>
) => formatQuantityWithUnit(qty, unitId ? (unitMap.get(unitId) ?? unitId) : null);

/**
 * The recipe as plain text for the clipboard: name, source, ingredients, numbered steps and
 * notes, each block separated by a blank line. Built from the data rather than read off the
 * rendered sheet, so the sheet's layout is free to use grids without mangling the copy.
 */
export const formatRecipeAsText = (
    recipe: RecipeWithDetails,
    unitMap: Map<string, string>
): string => {
    const blocks: string[] = [];

    blocks.push([recipe.name, recipe.source].filter(Boolean).join("\n"));

    if (recipe.ingredients.length > 0) {
        const lines = recipe.ingredients.map((ing) => {
            const line = [formatIngredientAmount(ing.qty, ing.unitId, unitMap), ing.name]
                .filter(Boolean)
                .join(" ");
            return ing.notes?.trim() ? `${line} (${ing.notes.trim()})` : line;
        });
        blocks.push(["Ingredients", ...lines].join("\n"));
    }

    const steps = splitRecipeSteps(recipe.steps);
    if (steps.length > 0) {
        const lines = steps.length === 1 ? steps : steps.map((step, i) => `${i + 1}. ${step}`);
        blocks.push(["Steps", ...lines].join("\n"));
    }

    const notes = recipe.description?.trim();
    if (notes) blocks.push(`Notes\n${notes}`);

    return blocks.join("\n\n");
};
