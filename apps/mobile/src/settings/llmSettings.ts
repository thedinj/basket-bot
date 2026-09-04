/**
 * Pure translation from the settings form to what the LLM subsystem must persist.
 *
 * Kept out of the form hook so it can be tested without a DOM, because the interesting
 * behaviour here is not rendering but *what gets written*:
 *
 * - **Which provider a value belongs to.** A submit that changes provider *and* supplies a
 *   key must file that key under the newly selected provider; deriving the target from the
 *   stored config would write it into the previous provider's slot, where nothing reads it.
 * - **Whether a value gets written at all.** A tier the user has left on its default is
 *   omitted entirely rather than saved as a copy of today's default. That omission is what
 *   lets the backend catalogue move a model without every install being pinned to the name
 *   it happened to see. Resolving a blank to `provider.defaultModels[tier]` here — which is
 *   what this used to do — froze the defaults into storage on the first save.
 */

import { LLM_TIERS, type LLMTier } from "@basket-bot/core";
import type { LLMConfig } from "../llm/config/llmConfig";
import { getProviderOrDefault } from "../llm/providers/registry";
import type { SettingsFormData } from "./settingsSchema";

/** The subset of the settings form that describes the LLM provider. */
export type LLMSettingsFields = Pick<
    SettingsFormData,
    | "llmProviderId"
    | "llmBaseUrl"
    | "llmApiKey"
    | "llmModelFast"
    | "llmUseDefaultFast"
    | "llmModelSmart"
    | "llmUseDefaultSmart"
    | "llmModelVision"
    | "llmUseDefaultVision"
>;

/** The two form fields backing one tier. Adding a tier is a compile error until listed. */
export const MODEL_FIELDS: Record<
    LLMTier,
    { value: keyof LLMSettingsFields; useDefault: keyof LLMSettingsFields }
> = {
    fast: { value: "llmModelFast", useDefault: "llmUseDefaultFast" },
    smart: { value: "llmModelSmart", useDefault: "llmUseDefaultSmart" },
    vision: { value: "llmModelVision", useDefault: "llmUseDefaultVision" },
};

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

    const models: LLMConfig["models"] = {};
    for (const tier of LLM_TIERS) {
        const { value, useDefault } = MODEL_FIELDS[tier];
        if (fields[useDefault]) continue;

        // A blank field with the toggle off is still "use the default" — there is no model
        // to store, and storing "" would fail the schema and discard the whole config.
        const override = cleared(fields[value] as string | undefined);
        if (override) models[tier] = override;
    }

    return {
        config: {
            providerId: provider.id,
            // A host the provider pins is not the user's to override, so a stale value
            // left in the form from a previous provider is discarded rather than stored.
            baseUrl: provider.baseUrlEditable ? cleared(fields.llmBaseUrl) : undefined,
            models,
        },
        apiKey: key ? { providerId: provider.id, value: key } : null,
    };
};
