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
 */

import { anthropicProvider } from "./anthropicProvider";
import { openAICompatibleProvider } from "./openAICompatibleProvider";
import type { LLMProviderDescriptor } from "./types";

export const LLM_PROVIDERS: readonly LLMProviderDescriptor[] = [
    {
        id: "openai",
        label: "OpenAI",
        adapter: openAICompatibleProvider,
        requiresApiKey: true,
        defaultBaseUrl: "https://api.openai.com/v1",
        baseUrlEditable: false,
        apiKeyPlaceholder: "sk-...",
        defaultModels: {
            fast: "gpt-4o-mini",
            smart: "gpt-4o",
            vision: "gpt-4o",
        },
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
        hint: "Uses the Claude Messages API directly.",
    },
    {
        id: "openai-compatible",
        label: "OpenAI-compatible",
        adapter: openAICompatibleProvider,
        requiresApiKey: true,
        defaultBaseUrl: "http://localhost:11434/v1",
        baseUrlEditable: true,
        apiKeyPlaceholder: "API key (any value if the server ignores it)",
        defaultModels: {
            fast: "llama3.2",
            smart: "llama3.2",
            vision: "llama3.2-vision",
        },
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
