/**
 * Persisted LLM configuration: which provider, where it lives, and which model backs
 * each capability tier.
 *
 * Stored as a single JSON blob so adding a field never means adding a preference key.
 * Parsing is pure and total — a missing, corrupt, or stale blob yields the default
 * configuration rather than an error, because the user has no way to repair it except
 * through Settings, which needs a valid object to render.
 */

import { z } from "zod";
import { DEFAULT_PROVIDER_ID, getProvider, getProviderOrDefault } from "../providers/registry";
import { LLM_TIERS, type LLMTier } from "../providers/types";

/** Capacitor Preferences key holding the JSON blob. */
export const LLM_CONFIG_PREFERENCE_KEY = "llm_config";

export const llmConfigSchema = z.object({
    providerId: z.string().min(1),
    /** Only meaningful for providers whose descriptor sets `baseUrlEditable`. */
    baseUrl: z.string().optional(),
    models: z.object({
        fast: z.string().min(1),
        smart: z.string().min(1),
        vision: z.string().min(1),
    }),
});

export type LLMConfig = z.infer<typeof llmConfigSchema>;

/** The configuration an install starts with, matching the behaviour before this existed. */
export const defaultLLMConfig = (): LLMConfig => {
    const provider = getProvider(DEFAULT_PROVIDER_ID);
    return {
        providerId: provider.id,
        models: { ...provider.defaultModels },
    };
};

/**
 * Parse a stored blob. Never throws: anything unusable becomes the default config, and a
 * config naming a provider that no longer exists is repaired rather than rejected.
 */
export const parseLLMConfig = (raw: string | null | undefined): LLMConfig => {
    if (!raw) return defaultLLMConfig();

    let candidate: unknown;
    try {
        candidate = JSON.parse(raw);
    } catch {
        return defaultLLMConfig();
    }

    const result = llmConfigSchema.safeParse(candidate);
    if (!result.success) return defaultLLMConfig();

    const provider = getProviderOrDefault(result.data.providerId);
    return { ...result.data, providerId: provider.id };
};

export const serializeLLMConfig = (config: LLMConfig): string => JSON.stringify(config);

/**
 * The model backing a tier, falling back to the provider's default when the user has
 * cleared the field.
 */
export const resolveModel = (config: LLMConfig, tier: LLMTier): string => {
    const provider = getProviderOrDefault(config.providerId);
    return config.models[tier]?.trim() || provider.defaultModels[tier];
};

/** The base URL to call, honouring the user's override only where the provider allows one. */
export const resolveBaseUrl = (config: LLMConfig): string => {
    const provider = getProviderOrDefault(config.providerId);
    if (!provider.baseUrlEditable) return provider.defaultBaseUrl;
    return config.baseUrl?.trim() || provider.defaultBaseUrl;
};

/** A config seeded with a provider's own defaults, used when the user switches provider. */
export const configForProvider = (providerId: string): LLMConfig => {
    const provider = getProviderOrDefault(providerId);
    return {
        providerId: provider.id,
        baseUrl: provider.baseUrlEditable ? provider.defaultBaseUrl : undefined,
        models: { ...provider.defaultModels },
    };
};

export { LLM_TIERS };
export type { LLMTier };
