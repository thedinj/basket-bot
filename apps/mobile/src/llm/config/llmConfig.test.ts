/**
 * Guards the one piece of LLM configuration that must never throw: parsing whatever
 * happens to be in Preferences. Settings cannot render without a valid config object, so
 * a corrupt or stale blob has to degrade to the defaults rather than surface an error.
 */

import { describe, expect, it } from "vitest";
import { LLM_PROVIDERS, getProvider } from "../providers/registry";
import {
    configForProvider,
    defaultLLMConfig,
    parseLLMConfig,
    resolveBaseUrl,
    resolveModel,
    serializeLLMConfig,
} from "./llmConfig";

describe("parseLLMConfig", () => {
    it("falls back to the OpenAI defaults when nothing is stored", () => {
        const openai = getProvider("openai");
        expect(parseLLMConfig(null)).toEqual({
            providerId: "openai",
            models: openai.defaultModels,
        });
    });

    it("falls back to the defaults for unparseable JSON", () => {
        expect(parseLLMConfig("{not json")).toEqual(defaultLLMConfig());
    });

    it("falls back to the defaults when the blob is missing required fields", () => {
        expect(parseLLMConfig(JSON.stringify({ providerId: "openai" }))).toEqual(
            defaultLLMConfig()
        );
    });

    it("repairs a config naming a provider that no longer exists", () => {
        const stored = serializeLLMConfig({
            providerId: "provider-removed-in-a-later-release",
            models: { fast: "a", smart: "b", vision: "c" },
        });
        const parsed = parseLLMConfig(stored);

        expect(parsed.providerId).toBe("openai");
        // The user's model choices survive the provider repair.
        expect(parsed.models).toEqual({ fast: "a", smart: "b", vision: "c" });
    });

    it("round-trips a valid config unchanged", () => {
        const config = configForProvider("anthropic");
        expect(parseLLMConfig(serializeLLMConfig(config))).toEqual(config);
    });
});

describe("resolveModel", () => {
    it("returns the configured model for the tier", () => {
        const config = configForProvider("anthropic");
        const anthropic = getProvider("anthropic");
        expect(resolveModel(config, "fast")).toBe(anthropic.defaultModels.fast);
        expect(resolveModel(config, "vision")).toBe(anthropic.defaultModels.vision);
    });

    it("falls back to the provider default when the user cleared the field", () => {
        const config = {
            ...configForProvider("openai"),
            models: { fast: "  ", smart: "", vision: "" },
        };
        expect(resolveModel(config, "fast")).toBe(getProvider("openai").defaultModels.fast);
    });
});

describe("resolveBaseUrl", () => {
    it("ignores a stored base URL for providers that pin their host", () => {
        const config = { ...configForProvider("openai"), baseUrl: "https://evil.example.com" };
        expect(resolveBaseUrl(config)).toBe(getProvider("openai").defaultBaseUrl);
    });

    it("honours the override for providers that allow one", () => {
        const config = {
            ...configForProvider("openai-compatible"),
            baseUrl: "http://192.168.1.10:1234/v1",
        };
        expect(resolveBaseUrl(config)).toBe("http://192.168.1.10:1234/v1");
    });
});

describe("provider registry", () => {
    it("throws on an unknown provider id rather than silently picking a vendor", () => {
        expect(() => getProvider("nope")).toThrow(/Unknown LLM provider/);
    });

    it("gives every provider a model for all three tiers", () => {
        for (const provider of LLM_PROVIDERS) {
            expect(provider.defaultModels.fast, provider.id).toBeTruthy();
            expect(provider.defaultModels.smart, provider.id).toBeTruthy();
            expect(provider.defaultModels.vision, provider.id).toBeTruthy();
        }
    });

    it("gives every provider a unique id", () => {
        const ids = LLM_PROVIDERS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
