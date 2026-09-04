/**
 * Hook for auto-categorization feature
 */

import type { StoreAisle, StoreSection } from "@basket-bot/core";
import pluralize from "pluralize";
import { useCallback } from "react";
import { useShield } from "../../components/shield/useShield";
import { useLLMConfig } from "../config/useLLMConfig";
import { runLLM } from "../shared/runLLM";
import {
    autoCategorizeResultSchema,
    transformAutoCategorizeResult,
    type AutoCategorizeInput,
} from "./autoCategorize";
import { AUTO_CATEGORIZE_PROMPT } from "./autoCategorizePrompt";

export interface UseAutoCategorizeOptions {
    itemName: string;
    fullAisles: StoreAisle[]; // Full aisle data for ID resolution
    fullSections: StoreSection[]; // Full section data for ID resolution
}

export interface UseAutoCategorizeResult {
    aisleId: string | null;
    sectionId: string | null;
    aisleName?: string;
    sectionName?: string;
}

/**
 * Hook that provides auto-categorization functionality.
 * Component will suspend until API key is loaded (via Suspense).
 */
export function useAutoCategorize() {
    // `effectiveConfig`, not `config`: the stored one omits every default the user never
    // overrode, so its model fields can be blank.
    const { effectiveConfig: llmConfig, provider, apiKey, isReady } = useLLMConfig();
    const { raiseShield, lowerShield } = useShield();

    const autoCategorize = useCallback(
        async ({
            itemName,
            fullAisles,
            fullSections,
        }: UseAutoCategorizeOptions): Promise<UseAutoCategorizeResult> => {
            const shieldId = "auto-categorize";

            try {
                raiseShield(shieldId);

                if (!isReady) {
                    throw new Error(`No ${provider.label} API key configured`);
                }

                if (!itemName?.trim()) {
                    throw new Error("Item name is required");
                }

                if (!fullAisles || fullAisles.length === 0) {
                    throw new Error("No aisles available");
                }

                // First check if there is an exact match in the aisle or section names (case insensitive, singular)
                const normalizedItemName = pluralize.singular(itemName.trim().toLowerCase());

                // Check for exact section match
                for (const section of fullSections) {
                    const normalizedSectionName = pluralize.singular(
                        section.name.trim().toLowerCase()
                    );
                    if (normalizedSectionName === normalizedItemName) {
                        const aisle = fullAisles.find((a) => a.id === section.aisleId);
                        return {
                            aisleId: section.aisleId,
                            sectionId: section.id,
                            aisleName: aisle?.name,
                            sectionName: section.name,
                        };
                    }
                }

                // Check for exact aisle match
                for (const aisle of fullAisles) {
                    const normalizedAisleName = pluralize.singular(aisle.name.trim().toLowerCase());
                    if (normalizedAisleName === normalizedItemName) {
                        return {
                            aisleId: aisle.id,
                            sectionId: null,
                            aisleName: aisle.name,
                            sectionName: undefined,
                        };
                    }
                }

                // Build minimal structure for LLM (name-only, no IDs)
                const aisles: AutoCategorizeInput["aisles"] = fullAisles.map((aisle) => {
                    const aisleSections = fullSections.filter((s) => s.aisleId === aisle.id);
                    const aisleData: { name: string; sections?: string[] } = {
                        name: aisle.name,
                    };
                    // Only include sections field if there are sections
                    if (aisleSections.length > 0) {
                        aisleData.sections = aisleSections.map((s) => s.name);
                    }
                    return aisleData;
                });

                const input: AutoCategorizeInput = {
                    itemName: itemName,
                    aisles,
                };

                const response = await runLLM({
                    tier: "fast",
                    schema: autoCategorizeResultSchema,
                    prompt: AUTO_CATEGORIZE_PROMPT,
                    userText: JSON.stringify(input),
                    config: llmConfig,
                    apiKey,
                });

                const { aisleId, sectionId } = transformAutoCategorizeResult(
                    response.data,
                    fullAisles,
                    fullSections
                );

                if (!aisleId) {
                    throw new Error("Could not determine a matching aisle/section");
                }

                // Find names for the result
                const aisle = fullAisles.find((a) => a.id === aisleId);
                const section = fullSections.find((s) => s.id === sectionId);

                return {
                    aisleId,
                    sectionId,
                    aisleName: aisle?.name,
                    sectionName: section?.name,
                };
            } finally {
                lowerShield(shieldId);
            }
        },
        [llmConfig, provider, apiKey, isReady, raiseShield, lowerShield]
    );

    return autoCategorize;
}
