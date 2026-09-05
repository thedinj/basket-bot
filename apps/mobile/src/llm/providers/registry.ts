/**
 * The provider registry — the one place a vendor is named.
 *
 * Follows the descriptor-registry shape used by `storeTemplates.ts` in the backend:
 * a frozen list of descriptors, a lookup that throws on an unknown id, and a summary
 * listing for the UI. Adding a provider means adding one entry here; no feature, call
 * site, or settings field changes.
 *
 * Adding a backend proxy later is the same one-entry change — `requiresApiKey: false`
 * and an adapter that POSTs to the app's own API.
 *
 * The model names below are **fallbacks**, not the source of truth: the backend serves the
 * live catalogue at `GET /api/llm/catalog` so a model can be swapped without an app
 * release. These are what the app uses when that is unreachable, so keep them roughly in
 * step with `apps/backend/src/lib/data/llmCatalog.ts` — but a device on an old build
 * reaching a current backend gets the current models either way, which is the point.
 */

import { anthropicProvider } from "./anthropicProvider";
import { createOpenAICompatibleProvider } from "./openAICompatibleProvider";
import type { LLMProviderDescriptor } from "./types";

export const LLM_PROVIDERS: readonly LLMProviderDescriptor[] = [
    {
        id: "openai",
        label: "OpenAI",
        // Current OpenAI models reject the older `max_tokens` outright.
        adapter: createOpenAICompatibleProvider({ outputTokenParam: "max_completion_tokens" }),
        requiresApiKey: true,
        defaultBaseUrl: "https://api.openai.com/v1",
        baseUrlEditable: false,
        apiKeyPlaceholder: "sk-...",
        defaultModels: {
            fast: "gpt-5.6-luna",
            smart: "gpt-5.6-sol",
            vision: "gpt-5.6-sol",
        },
        knownModels: [
            { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (fastest, cheapest)", tiers: ["fast"] },
            {
                id: "gpt-5.6-terra",
                label: "GPT-5.6 Terra (balanced)",
                tiers: ["fast", "smart", "vision"],
            },
            { id: "gpt-5.6-sol", label: "GPT-5.6 Sol (most capable)", tiers: ["smart", "vision"] },
            { id: "gpt-6-astra", label: "GPT-6 Astra (flagship)", tiers: ["smart", "vision"] },
        ],
        hint: "Uses the OpenAI API directly.",
    },
    {
        id: "anthropic",
        label: "Anthropic",
        adapter: anthropicProvider,
        requiresApiKey: true,
        defaultBaseUrl: "https://api.anthropic.com",
        baseUrlEditable: false,
        apiKeyPlaceholder: "sk-ant-...",
        defaultModels: {
            fast: "claude-haiku-4-5",
            smart: "claude-opus-5",
            vision: "claude-opus-5",
        },
        knownModels: [
            {
                id: "claude-haiku-4-5",
                label: "Claude Haiku 4.5 (fastest, cheapest)",
                tiers: ["fast"],
            },
            {
                id: "claude-sonnet-5",
                label: "Claude Sonnet 5 (balanced)",
                tiers: ["fast", "smart", "vision"],
            },
            {
                id: "claude-opus-5",
                label: "Claude Opus 5 (most capable)",
                tiers: ["smart", "vision"],
            },
            {
                id: "claude-fable-5",
                label: "Claude Fable 5 (flagship)",
                tiers: ["smart", "vision"],
            },
        ],
        hint: "Uses the Claude Messages API directly.",
    },
    {
        id: "openai-compatible",
        label: "OpenAI-compatible",
        // Self-hosted servers overwhelmingly still take `max_tokens`; the adapter retries
        // under the newer name if one turns out not to.
        adapter: createOpenAICompatibleProvider({ outputTokenParam: "max_tokens" }),
        requiresApiKey: true,
        defaultBaseUrl: "http://localhost:11434/v1",
        baseUrlEditable: true,
        apiKeyPlaceholder: "API key (any value if the server ignores it)",
        defaultModels: {
            fast: "llama3.2",
            smart: "llama3.2",
            vision: "llama3.2-vision",
        },
        // Whatever server the user runs — we have nothing true to say about its models, so
        // the picker falls back to free text. The backend's catalogue omits it for the same
        // reason.
        knownModels: [],
        hint: "Any server speaking the OpenAI protocol — OpenRouter, Groq, Ollama, LM Studio.",
    },
] as const;

/** The provider assumed for installs that predate configurable providers. */
export const DEFAULT_PROVIDER_ID = "openai";

/** Look up a provider, throwing rather than silently falling back to the wrong vendor. */
export const getProvider = (id: string): LLMProviderDescriptor => {
    const provider = LLM_PROVIDERS.find((candidate) => candidate.id === id);
    if (!provider) {
        throw new Error(`Unknown LLM provider "${id}"`);
    }
    return provider;
};

/** Same lookup, but for callers that must render something for a stale stored id. */
export const getProviderOrDefault = (id: string): LLMProviderDescriptor =>
    LLM_PROVIDERS.find((candidate) => candidate.id === id) ?? getProvider(DEFAULT_PROVIDER_ID);

/** Options for the provider picker in Settings. */
export const listProviders = (): Array<Pick<LLMProviderDescriptor, "id" | "label" | "hint">> =>
    LLM_PROVIDERS.map(({ id, label, hint }) => ({ id, label, hint }));
