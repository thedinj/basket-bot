/**
 * Provider-agnostic LLM types.
 *
 * Nothing in this file may name a vendor. Each concrete provider lives in its own
 * adapter module and is reached only through the registry, so adding a provider
 * (including a future backend proxy) never touches a feature or a call site.
 */

import { LLM_TIERS } from "@basket-bot/core";
import type { LLMModelOption, LLMTier } from "@basket-bot/core";
import type { LLMAttachment, LLMResponse } from "../shared/types";

/**
 * Capability tier a feature asks for. Features declare a tier, never a model —
 * the concrete model is resolved from the user's configuration at call time.
 *
 * - `fast`   — high-volume, low-stakes work (item categorization)
 * - `smart`  — reasoning over free text (recipe / list parsing)
 * - `vision` — anything with an image attached; `runLLM` upgrades to this tier
 *              automatically when a request carries attachments
 *
 * Defined in `@basket-bot/core` because the tier names are part of the wire contract for
 * the model catalogue the backend serves, and re-exported here so no call site has to care.
 */
export { LLM_TIERS };
export type { LLMModelOption, LLMTier };

/**
 * A single vendor-neutral request. Providers translate this into their own wire format.
 */
export interface LLMRequest {
    /** Instructions the user never sees. Sent in the provider's system channel. */
    systemPrompt: string;
    /** Untrusted user-supplied text. Always sent in the user channel, never the system one. */
    userText?: string;
    attachments?: LLMAttachment[];
    model: string;
    /**
     * The resolved tier, passed through so an adapter can map it onto a provider-specific
     * effort/reasoning knob. Adapters that have no such knob ignore it.
     */
    tier: LLMTier;
    /**
     * JSON Schema derived from the caller's Zod schema. Providers that can constrain
     * output to a schema should use it; the rest fall back to plain JSON mode and rely
     * on `runLLM` validating the result with Zod either way.
     */
    jsonSchema?: Record<string, unknown>;
}

/** Everything a provider needs beyond the request itself. */
export interface LLMProviderContext {
    /** Absent for providers with `requiresApiKey: false` (e.g. a future backend proxy). */
    apiKey?: string;
    /** Absent when the descriptor pins a fixed base URL. */
    baseUrl?: string;
}

/**
 * The whole provider contract. Implementations return the parsed JSON payload;
 * schema validation is `runLLM`'s job, not the adapter's.
 */
export interface LLMProviderAdapter {
    call(request: LLMRequest, context: LLMProviderContext): Promise<LLMResponse>;
}

/**
 * A provider entry in the registry. Mirrors the descriptor-registry shape used by
 * `apps/backend/src/lib/data/storeTemplates.ts`.
 */
export interface LLMProviderDescriptor {
    id: string;
    /** Shown in Settings and in every user-facing error message. */
    label: string;
    adapter: LLMProviderAdapter;
    /** False for providers that authenticate some other way (backend proxy, local server). */
    requiresApiKey: boolean;
    /** Used when `baseUrlEditable` is false, and as the prefilled value when it is true. */
    defaultBaseUrl: string;
    /** Whether the user may point this provider at a different host. */
    baseUrlEditable: boolean;
    apiKeyPlaceholder: string;
    /**
     * **Offline fallback only.** The backend's catalogue is the source of truth for model
     * names (`GET /api/llm/catalog`); these are what the app falls back to when it is
     * unreachable, and what a provider the catalogue says nothing about keeps using.
     * Resolve through `resolveProviderCatalog` rather than reading this directly.
     */
    defaultModels: Record<LLMTier, string>;
    /** Offline fallback for the model picker, on the same terms as `defaultModels`. */
    knownModels: readonly LLMModelOption[];
    /** One line of help shown under the provider picker. */
    hint: string;
}
