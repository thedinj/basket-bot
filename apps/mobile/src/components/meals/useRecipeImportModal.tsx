import { useCallback } from "react";
import { useQuantityUnits } from "../../db/hooks";
import {
    validateRecipeImportResult,
    type RecipeImportResponse,
} from "../../llm/features/recipeImport";
import { RECIPE_IMPORT_PROMPT } from "../../llm/features/recipeImportPrompt";
import { useLLMModal } from "../../llm/shared/useLLMModal";
import { matchUnitId } from "../../utils/stringUtils";
import type { RecipeInitialData } from "./RecipeEditorModal";
import RecipeImportPreview from "./RecipeImportPreview";

/**
 * Hook to open the LLM recipe import modal.
 * On accept, calls onAccepted with pre-populated form data for the Recipe Editor.
 */
export function useRecipeImportModal(onAccepted: (data: RecipeInitialData) => void) {
    const { openModal } = useLLMModal();
    const { data: units } = useQuantityUnits();

    const openRecipeImport = useCallback(() => {
        openModal<RecipeImportResponse, Set<number>>({
            title: "Import Recipe",
            prompt: RECIPE_IMPORT_PROMPT,
            model: "gpt-4o",
            userInstructions:
                "Paste recipe text or upload a photo of a recipe card or cookbook page.",
            buttonText: "Extract Recipe",
            shieldMessage: "Extracting recipe with AI...",
            validateResponse: (response) => {
                if (!validateRecipeImportResult(response.data)) {
                    throw new Error("Could not parse a recipe from the response.");
                }
                return true;
            },
            initialState: (response) =>
                new Set<number>(
                    response.data.recipe.ingredients
                        .map((ing, idx) => (ing.isPantryItem === true ? idx : -1))
                        .filter((idx) => idx !== -1)
                ),
            renderOutput: (response, excludedIds, setExcludedIds) => (
                <RecipeImportPreview
                    recipe={response.data.recipe}
                    excludedIds={excludedIds}
                    onToggle={(idx, excluded) => {
                        setExcludedIds((prev) => {
                            const next = new Set(prev);
                            if (excluded) next.add(idx);
                            else next.delete(idx);
                            return next;
                        });
                    }}
                />
            ),
            onAccept: (response, excludedIds) => {
                const { name, source, description, steps, cookingTimeMinutes, ingredients } =
                    response.data.recipe;
                const initialData: RecipeInitialData = {
                    name,
                    source: source ?? undefined,
                    description: description ?? undefined,
                    steps: steps ?? undefined,
                    cookingTimeMinutes: cookingTimeMinutes ?? undefined,
                    ingredients: ingredients.map((ing, idx) => ({
                        name: ing.name,
                        shoppingName: ing.shoppingName ?? null,
                        qty: ing.qty !== null ? String(ing.qty) : "",
                        shoppingQty: ing.shoppingQty ?? null,
                        unitId: matchUnitId(ing.unit, units),
                        shoppingUnitId: matchUnitId(ing.shoppingUnit ?? null, units),
                        excluded: excludedIds.has(idx),
                    })),
                };
                onAccepted(initialData);
            },
        });
    }, [openModal, units, onAccepted]);

    return { openRecipeImport };
}
