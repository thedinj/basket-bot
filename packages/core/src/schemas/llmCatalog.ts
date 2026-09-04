/**
 * The catalogue of LLM models the backend serves and the mobile client renders.
 *
 * Model names are **data, not code**. They change on the vendors' schedule, not ours, so
 * they live server-side and reach the app over the wire — bumping a default is a backend
 * edit plus a redeploy, never a mobile release that every user has to install.
 *
 * What stays in the client is provider *identity*: each provider is bound to a code adapter
 * that speaks its wire format, so `providerId` here names an entry the client already knows.
 * An id the client has never heard of is ignored rather than treated as an error, which is
 * what lets the backend list a provider ahead of the release that can talk to it.
 */

import { z } from "zod";

/**
 * Capability tier a feature asks for. Features declare a tier, never a model.
 *
 * - `fast`   — high-volume, low-stakes work (item categorization)
 * - `smart`  — reasoning over free text (recipe / list parsing)
 * - `vision` — anything with an image attached
 */
export const llmTierSchema = z.enum(["fast", "smart", "vision"]);

export type LLMTier = z.infer<typeof llmTierSchema>;

/** Iteration order for the tiers — the order Settings renders them in. */
export const LLM_TIERS = llmTierSchema.options;

/** One selectable model. */
export const llmModelOptionSchema = z.object({
    /** The exact string sent as the provider's `model` parameter. A typo here is a 404. */
    id: z.string().min(1),
    /** What Settings shows in the picker. */
    label: z.string().min(1),
    /**
     * Which tier pickers may offer this model. Not a hard capability claim — every current
     * model on both hosted vendors accepts images — but a cost/quality judgement about
     * where the model belongs, which is what keeps a budget model out of the vision picker.
     */
    tiers: z.array(llmTierSchema).min(1),
});

export type LLMModelOption = z.infer<typeof llmModelOptionSchema>;

/** The model backing each tier when the user has not overridden it. */
export const llmDefaultModelsSchema = z.object({
    fast: z.string().min(1),
    smart: z.string().min(1),
    vision: z.string().min(1),
});

export type LLMDefaultModels = z.infer<typeof llmDefaultModelsSchema>;

export const llmProviderCatalogSchema = z.object({
    /** Matches an id in the client's provider registry; unknown ids are ignored. */
    providerId: z.string().min(1),
    defaultModels: llmDefaultModelsSchema,
    models: z.array(llmModelOptionSchema),
});

export type LLMProviderCatalog = z.infer<typeof llmProviderCatalogSchema>;

export const llmCatalogSchema = z.object({
    /** When the catalogue was last edited. Diagnostics only — nothing branches on it. */
    updatedAt: z.string(),
    /**
     * A provider absent from this list is not an error: the client falls back to the
     * defaults bundled in its own registry, which is how `openai-compatible` (an arbitrary
     * user-run server we can say nothing useful about) and an offline device both work.
     */
    providers: z.array(llmProviderCatalogSchema),
});

export type LLMCatalog = z.infer<typeof llmCatalogSchema>;

/** Response body of `GET /api/llm/catalog`. */
export const llmCatalogResponseSchema = z.object({ catalog: llmCatalogSchema });

export type LLMCatalogResponse = z.infer<typeof llmCatalogResponseSchema>;
