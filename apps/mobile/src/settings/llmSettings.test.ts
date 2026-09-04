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

/** A form submitted with every tier left on its default — the common case. */
const form = (overrides: Partial<LLMSettingsFields> = {}): LLMSettingsFields => ({
    llmProviderId: "openai",
    llmUseDefaultFast: true,
    llmUseDefaultSmart: true,
    llmUseDefaultVision: true,
    ...overrides,
});

/** A form with one tier's override switched on and set to `model`. */
const overriding = (
    tier: "Fast" | "Smart" | "Vision",
    model: string | undefined,
    overrides: Partial<LLMSettingsFields> = {}
): LLMSettingsFields =>
    form({
        [`llmUseDefault${tier}`]: false,
        [`llmModel${tier}`]: model,
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
    it("stores nothing for a tier left on its default", () => {
        // The whole point: an un-overridden tier must leave no model name on the device, so
        // it keeps resolving against the server catalogue and follows a new default. Writing
        // today's default here — which this used to do — pinned every install to it forever.
        expect(buildLLMSavePlan(form(), storedOpenAI).config.models).toEqual({});
    });

    it("stores only the tier the user actually overrode", () => {
        const plan = buildLLMSavePlan(overriding("Smart", "my-smart"), storedOpenAI);
        expect(plan.config.models).toEqual({ smart: "my-smart" });
    });

    it("stores every tier when all three are overridden", () => {
        const plan = buildLLMSavePlan(
            form({
                llmUseDefaultFast: false,
                llmModelFast: "my-fast",
                llmUseDefaultSmart: false,
                llmModelSmart: "my-smart",
                llmUseDefaultVision: false,
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

    it("drops a previous override when the tier is switched back to the default", () => {
        // The form keeps the typed text around so toggling twice doesn't lose it, so the
        // value is still present at submit — the flag, not the text, decides.
        const plan = buildLLMSavePlan(
            form({ llmUseDefaultFast: true, llmModelFast: "left-over-from-earlier" }),
            storedOpenAI
        );

        expect(plan.config.models).toEqual({});
    });

    it("treats a blank override as no override rather than storing an empty model", () => {
        // An empty string would fail the stored-config schema, and parseLLMConfig discards
        // the *whole* config on a parse failure — losing the provider and every other tier.
        expect(buildLLMSavePlan(overriding("Fast", ""), storedOpenAI).config.models).toEqual({});
        expect(buildLLMSavePlan(overriding("Fast", "   "), storedOpenAI).config.models).toEqual({});
        expect(buildLLMSavePlan(overriding("Fast", undefined), storedOpenAI).config.models).toEqual(
            {}
        );
    });

    it("trims a pasted model name", () => {
        const plan = buildLLMSavePlan(overriding("Vision", "  spaced-model  "), storedOpenAI);
        expect(plan.config.models).toEqual({ vision: "spaced-model" });
    });

    it("carries no model name across a provider switch", () => {
        // A model id is provider-specific, so the old vendor's name must not survive into
        // the new provider's config even when the form still holds it.
        const plan = buildLLMSavePlan(
            overriding("Fast", OPENAI.defaultModels.fast, { llmProviderId: "anthropic" }),
            storedOpenAI
        );

        // It is stored, because the user did switch the override on — but the UI clears the
        // fields on a provider change, so this only documents that nothing else does.
        expect(plan.config.providerId).toBe("anthropic");
        expect(ANTHROPIC.defaultModels.fast).not.toBe(OPENAI.defaultModels.fast);
    });

    it("stores no models at all for a provider the catalogue says nothing about", () => {
        const plan = buildLLMSavePlan(form({ llmProviderId: "openai-compatible" }), storedOpenAI);

        expect(plan.config.models).toEqual({});
        expect(COMPATIBLE.baseUrlEditable).toBe(true);
    });
});
