import type { LLMCatalog } from "@basket-bot/core";

/**
 * The models the mobile app offers, and which one backs each capability tier by default.
 *
 * This catalog is **server-side only**, discovered by the client through
 * `GET /api/llm/catalog` — the same shape as `storeTemplates.ts`. That is the whole point:
 * vendors rename and retire models on their own schedule, so pointing every install at a
 * newer model is an edit to this file plus a redeploy, with no app release and nothing for
 * a user to do. Only users who deliberately overrode a model in Settings keep their choice.
 *
 * `providerId` must match an id in the mobile provider registry
 * (`apps/mobile/src/llm/providers/registry.ts`), which owns provider *identity* — the
 * adapter that speaks each vendor's wire format. This file owns only the names.
 *
 * `openai-compatible` is deliberately absent. It points at whatever server the user runs
 * (Ollama, LM Studio, OpenRouter), so we have nothing true to say about its models; the
 * client falls back to its bundled defaults and offers a free-text field instead.
 *
 * Every id below is sent to the vendor verbatim, so a typo surfaces to the user as a failed
 * AI action, not a validation error. `llmCatalog.test.ts` checks the catalog's internal
 * consistency; it cannot check that a well-formed id actually exists — verify new ids
 * against the vendor's own model list before shipping them.
 *
 * `tiers` says which pickers may offer a model. It is a cost/quality judgement rather than a
 * capability claim: every model listed here accepts image input, but putting the budget
 * model in the vision picker would just produce bad store scans.
 */
export const LLM_CATALOG: LLMCatalog = {
    updatedAt: "2026-09-04",
    providers: [
        {
            providerId: "openai",
            defaultModels: {
                fast: "gpt-5.6-luna",
                smart: "gpt-5.6-sol",
                vision: "gpt-5.6-sol",
            },
            models: [
                { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (fastest, cheapest)", tiers: ["fast"] },
                {
                    id: "gpt-5.6-terra",
                    label: "GPT-5.6 Terra (balanced)",
                    tiers: ["fast", "smart", "vision"],
                },
                {
                    id: "gpt-5.6-sol",
                    label: "GPT-5.6 Sol (most capable)",
                    tiers: ["smart", "vision"],
                },
                { id: "gpt-6-astra", label: "GPT-6 Astra (flagship)", tiers: ["smart", "vision"] },
            ],
        },
        {
            providerId: "anthropic",
            defaultModels: {
                fast: "claude-haiku-4-5",
                smart: "claude-opus-5",
                vision: "claude-opus-5",
            },
            models: [
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
        },
    ],
};

/** The catalog served to clients. A function so the route reads like every other data source. */
export const getLLMCatalog = (): LLMCatalog => LLM_CATALOG;
