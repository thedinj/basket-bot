import { useCallback } from "react";
import { useQuantityUnits } from "../../db/hooks";
import { useLLMConfig } from "../../llm/config/useLLMConfig";
import {
    applyShoppingMap,
    recipeImportResponseSchema,
    shoppingMapResponseSchema,
    type RecipeImportResponse,
} from "../../llm/features/recipeImport";
import { RECIPE_IMPORT_PROMPT } from "../../llm/features/recipeImportPrompt";
import { RECIPE_SHOPPING_MAP_PROMPT } from "../../llm/features/recipeShoppingMapPrompt";
import { runLLM } from "../../llm/shared/runLLM";
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
    // `effectiveConfig`, not `config`: the stored one omits every default the user never
    // overrode, so its model fields can be blank.
    const { effectiveConfig: llmConfig, apiKey } = useLLMConfig();

    const openRecipeImport = useCallback(() => {
        openModal<RecipeImportResponse, Set<number>>({
            title: "Import Recipe",
            prompt: RECIPE_IMPORT_PROMPT,
            tier: "smart",
            schema: recipeImportResponseSchema,
            userInstructions:
                "Paste recipe text or upload a photo of a recipe card or cookbook page.",
            buttonText: "Extract Recipe",
            shieldMessage: "Extracting recipe with AI...",
            postProcess: async (response) => {
                const ingredients = response.data.recipe.ingredients.map((ing, index) => ({
                    index,
                    name: ing.name,
                    qty: ing.qty,
                    unit: ing.unit,
                }));
                const mapResponse = await runLLM({
                    tier: "smart",
                    schema: shoppingMapResponseSchema,
                    prompt: RECIPE_SHOPPING_MAP_PROMPT,
                    userText: JSON.stringify({
                        recipeName: response.data.recipe.name,
                        ingredients,
                    }),
                    config: llmConfig,
                    apiKey,
                });
                return {
                    data: {
                        recipe: applyShoppingMap(response.data.recipe, mapResponse.data),
                    },
                    raw: response.raw,
                };
            },
            initialState: (response) =>
                new Set<number>(
                    response.data.recipe.ingredients
                        .map((ing, idx) => (ing.excluded === true ? idx : -1))
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
    }, [openModal, units, onAccepted, llmConfig, apiKey]);

    return { openRecipeImport };
}
