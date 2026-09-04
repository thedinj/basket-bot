/**
 * Merges the catalogue the backend serves with the fallbacks bundled in the provider
 * registry, and turns a *stored* config into an *effective* one.
 *
 * That distinction runs through the whole LLM config layer and is worth keeping straight:
 *
 * - **stored** (`LLMConfig` out of Preferences) — sparse. It holds a model name only for a
 *   tier the user deliberately overrode. Settings edits this.
 * - **effective** (`applyCatalogDefaults(...)`) — complete. Every blank filled from the
 *   catalogue, resolved fresh on each render. `runLLM` is handed this.
 *
 * Keeping the stored form sparse is what lets the backend move a default: nothing on the
 * device pins yesterday's model name. Everything here is pure and total — a null catalogue
 * (offline, old backend, still loading) resolves to the bundled fallbacks rather than
 * throwing, because Settings has to render and AI features have to work regardless.
 */

import type { LLMCatalog, LLMModelOption, LLMTier } from "@basket-bot/core";
import { LLM_TIERS } from "@basket-bot/core";
import type { LLMConfig } from "./llmConfig";
import { getProviderOrDefault } from "../providers/registry";

/** What a provider's models resolve to once the catalogue and the fallbacks are merged. */
export interface ResolvedProviderCatalog {
    defaultModels: Record<LLMTier, string>;
    models: readonly LLMModelOption[];
}

/**
 * The models to use for a provider: the catalogue's entry when it has one, else the
 * descriptor's bundled fallback.
 *
 * The choice is per provider rather than per field, so a catalogue entry is a complete
 * statement about that provider. Mixing a server default with a bundled model list could
 * otherwise leave a default that isn't in its own picker.
 */
export const resolveProviderCatalog = (
    providerId: string,
    catalog: LLMCatalog | null | undefined
): ResolvedProviderCatalog => {
    const provider = getProviderOrDefault(providerId);
    const entry = catalog?.providers.find((candidate) => candidate.providerId === provider.id);

    if (entry) {
        return { defaultModels: entry.defaultModels, models: entry.models };
    }

    return { defaultModels: provider.defaultModels, models: provider.knownModels };
};

/** The models a tier's picker may offer, in catalogue order. */
export const modelsForTier = (
    resolved: ResolvedProviderCatalog,
    tier: LLMTier
): readonly LLMModelOption[] => resolved.models.filter((model) => model.tiers.includes(tier));

/**
 * The effective config: the user's overrides, with every blank filled from the catalogue.
 *
 * Only ever used to *make a call* — never written back to Preferences, or the defaults
 * would be frozen into storage again.
 */
export const applyCatalogDefaults = (
    config: LLMConfig,
    catalog: LLMCatalog | null | undefined
): LLMConfig => {
    const provider = getProviderOrDefault(config.providerId);
    const resolved = resolveProviderCatalog(config.providerId, catalog);

    const models = {} as Record<LLMTier, string>;
    for (const tier of LLM_TIERS) {
        models[tier] = config.models?.[tier]?.trim() || resolved.defaultModels[tier];
    }

    return {
        ...config,
        // A host the provider pins is not the user's to override, and `resolveBaseUrl`
        // enforces that too; setting it here keeps the effective config self-describing.
        baseUrl: provider.baseUrlEditable
            ? config.baseUrl?.trim() || provider.defaultBaseUrl
            : provider.defaultBaseUrl,
        models,
    };
};
