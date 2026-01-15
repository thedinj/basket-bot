/**
 * Hook for auto-categorization feature
 */

import { useCallback } from "react";
import { useSecureApiKey } from "../../hooks/useSecureStorage";
import { callLLMDirect } from "../shared/directCall";
import {
    transformAutoCategorizeResult,
    validateAutoCategorizeResult,
    type AutoCategorizeInput,
} from "./autoCategorize";
import { AUTO_CATEGORIZE_PROMPT } from "./autoCategorizePrompt";

export interface UseAutoCategorizeOptions {
    itemName: string;
    aisles: AutoCategorizeInput["aisles"];
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
    const apiKeyValue = useSecureApiKey();

    const autoCategorize = useCallback(
        async ({
            itemName,
            aisles,
        }: UseAutoCategorizeOptions): Promise<UseAutoCategorizeResult> => {
            if (!apiKeyValue) {
                throw new Error("API key is not configured");
            }

            if (!itemName?.trim()) {
                throw new Error("Item name is required");
            }

            if (!aisles || aisles.length === 0) {
                throw new Error("No aisles available");
            }

            const input: AutoCategorizeInput = {
                itemName: itemName,
                aisles,
            };

            const response = await callLLMDirect({
                apiKey: apiKeyValue,
                prompt: AUTO_CATEGORIZE_PROMPT,
                userText: JSON.stringify(input),
                model: "gpt-4o",
            });

            if (!validateAutoCategorizeResult(response.data)) {
                throw new Error(
                    "Invalid response from AI: expected aisleName, sectionName, confidence, and reasoning fields"
                );
            }

            const { aisleId, sectionId } = transformAutoCategorizeResult(
                response.data,
                input.aisles
            );

            if (!aisleId) {
                throw new Error("Could not determine a matching aisle/section");
            }

            // Find names for the result
            const aisle = aisles.find((a) => a.id === aisleId);
            const section = aisle?.sections.find((s) => s.id === sectionId);

            return {
                aisleId,
                sectionId,
                aisleName: aisle?.name,
                sectionName: section?.name,
            };
        },
        [apiKeyValue]
    );

    return autoCategorize;
}
