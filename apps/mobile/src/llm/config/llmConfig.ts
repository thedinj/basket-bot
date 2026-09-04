/**
 * Persisted LLM configuration: which provider, where it lives, and which model backs
 * each capability tier.
 *
 * Stored as a single JSON blob so adding a field never means adding a preference key.
 * Parsing is pure and total — a missing, corrupt, or stale blob yields the default
 * configuration rather than an error, because the user has no way to repair it except
 * through Settings, which needs a valid object to render.
 *
 * **Only real overrides are stored.** A tier the user has not deliberately changed is
 * absent from `models`, so it resolves against the catalogue on every call and follows a
 * new default without the user doing anything. Writing today's default into storage would
 * silently pin the install to it forever, which is exactly the bug this shape prevents —
 * so widen the schema here if you must, but never fill a blank in on the way *in*.
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
    /**
     * Per-tier overrides. Every field is optional and absent means "follow the catalogue";
     * the object itself is optional so a config written before any override still parses.
     */
    models: z
        .object({
            fast: z.string().optional(),
            smart: z.string().optional(),
            vision: z.string().optional(),
        })
        .optional(),
});

export type LLMConfig = z.infer<typeof llmConfigSchema>;

/** The configuration an install starts with: a provider, and no overrides at all. */
export const defaultLLMConfig = (): LLMConfig => ({
    providerId: getProvider(DEFAULT_PROVIDER_ID).id,
    models: {},
});

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
 * The model backing a tier.
 *
 * Prefer passing an *effective* config (see `applyCatalogDefaults`), whose blanks are
 * already filled from the catalogue. The provider descriptor is the last-resort backstop
 * for a tier that is still unset — an offline first run, say — so this never returns "".
 */
export const resolveModel = (config: LLMConfig, tier: LLMTier): string => {
    const provider = getProviderOrDefault(config.providerId);
    return config.models?.[tier]?.trim() || provider.defaultModels[tier];
};

/** The base URL to call, honouring the user's override only where the provider allows one. */
export const resolveBaseUrl = (config: LLMConfig): string => {
    const provider = getProviderOrDefault(config.providerId);
    if (!provider.baseUrlEditable) return provider.defaultBaseUrl;
    return config.baseUrl?.trim() || provider.defaultBaseUrl;
};

/**
 * A config for a provider with nothing overridden — what switching provider produces.
 *
 * It deliberately copies no model names in: picking a provider means "use whatever that
 * provider's defaults are", now and after they next change.
 */
export const configForProvider = (providerId: string): LLMConfig => ({
    providerId: getProviderOrDefault(providerId).id,
    baseUrl: undefined,
    models: {},
});

export { LLM_TIERS };
export type { LLMTier };
