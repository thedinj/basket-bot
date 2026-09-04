/**
 * Pure translation from the settings form to what the LLM subsystem must persist.
 *
 * Kept out of the form hook so it can be tested without a DOM: the interesting behaviour
 * here is not rendering but which provider each value belongs to. In particular, a submit
 * that changes provider *and* supplies a key must file that key under the newly selected
 * provider — deriving the target from the stored config instead would write it into the
 * previous provider's slot, where nothing would ever read it.
 */

import { getProviderOrDefault } from "../llm/providers/registry";
import type { LLMConfig } from "../llm/config/llmConfig";
import type { SettingsFormData } from "./settingsSchema";

/** The subset of the settings form that describes the LLM provider. */
export type LLMSettingsFields = Pick<
    SettingsFormData,
    | "llmProviderId"
    | "llmBaseUrl"
    | "llmApiKey"
    | "llmModelFast"
    | "llmModelSmart"
    | "llmModelVision"
>;

export interface LLMSavePlan {
    config: LLMConfig;
    /**
     * The key to write and the provider slot it belongs in, or null when the user left the
     * field untouched — an empty field means "leave the stored key alone", never "clear it".
     */
    apiKey: { providerId: string; value: string } | null;
}

/** Empty and whitespace-only fields both count as "not supplied". */
const cleared = (value: string | undefined): string | undefined => value?.trim() || undefined;

/**
 * Work out the config to store and the key to write from one submitted form.
 *
 * @param fields The LLM portion of the submitted form
 * @param currentConfig The stored config, used only when the form names no provider
 */
export const buildLLMSavePlan = (
    fields: LLMSettingsFields,
    currentConfig: LLMConfig
): LLMSavePlan => {
    const provider = getProviderOrDefault(fields.llmProviderId ?? currentConfig.providerId);
    const key = cleared(fields.llmApiKey);

    return {
        config: {
            providerId: provider.id,
            // A host the provider pins is not the user's to override, so a stale value
            // left in the form from a previous provider is discarded rather than stored.
            baseUrl: provider.baseUrlEditable ? cleared(fields.llmBaseUrl) : undefined,
            models: {
                fast: cleared(fields.llmModelFast) ?? provider.defaultModels.fast,
                smart: cleared(fields.llmModelSmart) ?? provider.defaultModels.smart,
                vision: cleared(fields.llmModelVision) ?? provider.defaultModels.vision,
            },
        },
        apiKey: key ? { providerId: provider.id, value: key } : null,
    };
};
