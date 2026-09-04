/**
 * Covers the settings-form → stored-config translation, and above all the provider slot a
 * submitted API key is filed under.
 *
 * The failure this exists to prevent is silent: switching provider and entering that
 * provider's key in one submit wrote the key into the *previous* provider's slot, so the
 * save reported success, the key was stored, and every AI feature stayed disabled with no
 * error pointing at the cause.
 */

import { describe, expect, it } from "vitest";
import { configForProvider } from "../llm/config/llmConfig";
import { getProvider } from "../llm/providers/registry";
import { buildLLMSavePlan, type LLMSettingsFields } from "./llmSettings";

const OPENAI = getProvider("openai");
const ANTHROPIC = getProvider("anthropic");
const COMPATIBLE = getProvider("openai-compatible");

/** A form submitted with every LLM field left at its loaded value. */
const form = (overrides: Partial<LLMSettingsFields> = {}): LLMSettingsFields => ({
    llmProviderId: "openai",
    llmModelFast: OPENAI.defaultModels.fast,
    llmModelSmart: OPENAI.defaultModels.smart,
    llmModelVision: OPENAI.defaultModels.vision,
    ...overrides,
});

const storedOpenAI = configForProvider("openai");

describe("buildLLMSavePlan — API key slot", () => {
    it("files a key entered while switching provider under the NEW provider", () => {
        const plan = buildLLMSavePlan(
            form({
                llmProviderId: "anthropic",
                llmApiKey: "sk-ant-new",
                llmModelFast: ANTHROPIC.defaultModels.fast,
                llmModelSmart: ANTHROPIC.defaultModels.smart,
                llmModelVision: ANTHROPIC.defaultModels.vision,
            }),
            storedOpenAI // still says "openai" at the moment of submit
        );

        expect(plan.apiKey).toEqual({ providerId: "anthropic", value: "sk-ant-new" });
        expect(plan.config.providerId).toBe("anthropic");
    });

    it("leaves the stored key alone when the field is untouched", () => {
        // An empty key field means "keep what is saved", never "clear it" — otherwise
        // saving any unrelated setting would wipe the user's key.
        expect(buildLLMSavePlan(form(), storedOpenAI).apiKey).toBeNull();
    });

    it("treats a whitespace-only key field as untouched", () => {
        expect(buildLLMSavePlan(form({ llmApiKey: "   " }), storedOpenAI).apiKey).toBeNull();
    });

    it("trims a pasted key", () => {
        const plan = buildLLMSavePlan(form({ llmApiKey: "  sk-padded\n" }), storedOpenAI);
        expect(plan.apiKey).toEqual({ providerId: "openai", value: "sk-padded" });
    });
});

describe("buildLLMSavePlan — provider resolution", () => {
    it("keeps the stored provider when the form names none", () => {
        const plan = buildLLMSavePlan(
            form({ llmProviderId: undefined }),
            configForProvider("anthropic")
        );
        expect(plan.config.providerId).toBe("anthropic");
    });

    it("falls back to the default provider for an id no longer in the registry", () => {
        const plan = buildLLMSavePlan(form({ llmProviderId: "removed-provider" }), storedOpenAI);
        expect(plan.config.providerId).toBe("openai");
    });
});

describe("buildLLMSavePlan — base URL", () => {
    it("stores an override for a provider that allows one", () => {
        const plan = buildLLMSavePlan(
            form({ llmProviderId: "openai-compatible", llmBaseUrl: "http://192.168.1.10:1234/v1" }),
            storedOpenAI
        );
        expect(plan.config.baseUrl).toBe("http://192.168.1.10:1234/v1");
    });

    it("discards a base URL for a provider that pins its host", () => {
        // The field is hidden for these providers, so any value present is left over from
        // a previously selected provider and must not be persisted.
        const plan = buildLLMSavePlan(
            form({ llmProviderId: "anthropic", llmBaseUrl: "http://localhost:11434/v1" }),
            storedOpenAI
        );
        expect(plan.config.baseUrl).toBeUndefined();
    });

    it("treats a cleared base URL as no override", () => {
        const plan = buildLLMSavePlan(
            form({ llmProviderId: "openai-compatible", llmBaseUrl: "  " }),
            storedOpenAI
        );
        expect(plan.config.baseUrl).toBeUndefined();
    });
});

describe("buildLLMSavePlan — models", () => {
    it("stores the models the user typed", () => {
        const plan = buildLLMSavePlan(
            form({
                llmModelFast: "my-fast",
                llmModelSmart: "my-smart",
                llmModelVision: "my-vision",
            }),
            storedOpenAI
        );

        expect(plan.config.models).toEqual({
            fast: "my-fast",
            smart: "my-smart",
            vision: "my-vision",
        });
    });

    it("falls back to the selected provider's defaults for cleared fields", () => {
        // Never the *stored* provider's defaults — a blank field after switching provider
        // must not carry the old vendor's model name into the new provider's config.
        const plan = buildLLMSavePlan(
            form({
                llmProviderId: "anthropic",
                llmModelFast: "",
                llmModelSmart: "   ",
                llmModelVision: undefined,
            }),
            storedOpenAI
        );

        expect(plan.config.models).toEqual(ANTHROPIC.defaultModels);
    });

    it("produces a config that satisfies the stored-config contract", () => {
        const plan = buildLLMSavePlan(form({ llmProviderId: "openai-compatible" }), storedOpenAI);

        // Every tier must resolve to something non-empty, or runLLM has no model to call.
        expect(plan.config.models.fast).toBeTruthy();
        expect(plan.config.models.smart).toBeTruthy();
        expect(plan.config.models.vision).toBeTruthy();
        expect(COMPATIBLE.baseUrlEditable).toBe(true);
    });
});
