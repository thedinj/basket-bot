/**
 * Hook for suggesting aisle emoji: in bulk from the aisles management screen, or for one aisle
 * from its editor.
 */

import type { StoreAisle } from "@basket-bot/core";
import { useCallback } from "react";
import { useShield } from "../../components/shield/useShield";
import { useLLMConfig } from "../config/useLLMConfig";
import { runLLM } from "../shared/runLLM";
import {
    aisleEmojiResultSchema,
    suggestAisleEmoji,
    suggestEmojiForAisleName,
    type AisleEmojiResult,
    type AisleEmojiSuggestion,
} from "./aisleEmoji";
import { AISLE_EMOJI_PROMPT } from "./aisleEmojiPrompt";

export function useSuggestAisleEmoji() {
    // `effectiveConfig`, not `config`: the stored one omits defaults the user never overrode.
    const { effectiveConfig, provider, apiKey, isReady } = useLLMConfig();
    const { raiseShield, lowerShield } = useShield();

    const runModel = useCallback(
        async (userText: string): Promise<AisleEmojiResult> => {
            const shieldId = "suggest-aisle-emoji";
            raiseShield(shieldId, "Choosing aisle emoji...");
            try {
                if (!isReady) {
                    throw new Error(`No ${provider.label} API key configured`);
                }
                const response = await runLLM({
                    tier: "fast",
                    schema: aisleEmojiResultSchema,
                    prompt: AISLE_EMOJI_PROMPT,
                    userText,
                    config: effectiveConfig,
                    apiKey,
                });
                return response.data;
            } finally {
                lowerShield(shieldId);
            }
        },
        [effectiveConfig, provider, apiKey, isReady, raiseShield, lowerShield]
    );

    /** Named aisles without an emoji; resolves to [] without a model call if there are none. */
    const suggestForAisles = useCallback(
        (aisles: readonly Pick<StoreAisle, "id" | "name" | "emoji">[]) =>
            suggestAisleEmoji(aisles, runModel),
        [runModel]
    );

    /** One name, on request; null (no model call) for a blank or number-only name. */
    const suggestForName = useCallback(
        (name: string) => suggestEmojiForAisleName(name, runModel),
        [runModel]
    );

    return { suggestForAisles, suggestForName };
}

export type { AisleEmojiSuggestion };
