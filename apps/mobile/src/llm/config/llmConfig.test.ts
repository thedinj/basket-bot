/**
 * Guards the one piece of LLM configuration that must never throw: parsing whatever
 * happens to be in Preferences. Settings cannot render without a valid config object, so
 * a corrupt or stale blob has to degrade to the defaults rather than surface an error.
 *
 * It also pins the shape that keeps defaults *unfrozen*: a tier the user never overrode is
 * absent from the stored blob, so it resolves fresh every time and follows a new catalogue
 * default. A test that asserts a default was written to storage is asserting the bug.
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
    it("starts on the default provider with nothing overridden", () => {
        expect(parseLLMConfig(null)).toEqual({ providerId: "openai", models: {} });
    });

    it("keeps a config that omits `models` entirely", () => {
        // Written before overrides existed, or by a build that had nothing to store.
        const parsed = parseLLMConfig(JSON.stringify({ providerId: "anthropic" }));
        expect(parsed.providerId).toBe("anthropic");
        expect(resolveModel(parsed, "fast")).toBeTruthy();
    });

    it("keeps a partial `models` object without inventing the missing tiers", () => {
        const parsed = parseLLMConfig(
            JSON.stringify({ providerId: "openai", models: { smart: "my-smart" } })
        );
        expect(parsed.models).toEqual({ smart: "my-smart" });
    });

    it("keeps a fully-populated config written by an older build", () => {
        // Existing installs have every tier baked in; they are left alone deliberately, and
        // opt back into the default by toggling the tier in Settings.
        const legacy = { providerId: "openai", models: { fast: "a", smart: "b", vision: "c" } };
        expect(parseLLMConfig(JSON.stringify(legacy))).toEqual(legacy);
    });

    it("falls back to the defaults for unparseable JSON", () => {
        expect(parseLLMConfig("{not json")).toEqual(defaultLLMConfig());
    });

    it("falls back to the defaults when the blob has no provider at all", () => {
        expect(parseLLMConfig(JSON.stringify({ models: {} }))).toEqual(defaultLLMConfig());
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
    it("returns the user's override for the tier", () => {
        const config = { ...configForProvider("anthropic"), models: { fast: "my-fast" } };
        expect(resolveModel(config, "fast")).toBe("my-fast");
    });

    it("reads an unset tier from the provider rather than from storage", () => {
        // This is the guarantee the whole feature rests on: nothing is frozen in the config,
        // so changing the source of the default changes what gets called.
        const anthropic = getProvider("anthropic");
        expect(resolveModel(configForProvider("anthropic"), "smart")).toBe(
            anthropic.defaultModels.smart
        );
    });

    it("falls back to the provider default when the user cleared the field", () => {
        const config = {
            ...configForProvider("openai"),
            models: { fast: "  ", smart: "", vision: "" },
        };
        expect(resolveModel(config, "fast")).toBe(getProvider("openai").defaultModels.fast);
    });

    it("never returns an empty model, whatever is stored", () => {
        for (const tier of ["fast", "smart", "vision"] as const) {
            expect(resolveModel({ providerId: "openai" }, tier)).toBeTruthy();
        }
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

    it("gives every provider a fallback model for all three tiers", () => {
        // These back up the served catalogue, so an offline device still has a model to call.
        for (const provider of LLM_PROVIDERS) {
            expect(provider.defaultModels.fast, provider.id).toBeTruthy();
            expect(provider.defaultModels.smart, provider.id).toBeTruthy();
            expect(provider.defaultModels.vision, provider.id).toBeTruthy();
        }
    });

    it("lists each fallback default among that provider's fallback models", () => {
        for (const provider of LLM_PROVIDERS) {
            // `openai-compatible` points at an arbitrary server, so it lists none by design.
            if (provider.knownModels.length === 0) continue;

            for (const tier of ["fast", "smart", "vision"] as const) {
                const model = provider.knownModels.find(
                    (candidate) => candidate.id === provider.defaultModels[tier]
                );
                expect(model, `${provider.id} ${tier}`).toBeDefined();
                expect(model?.tiers).toContain(tier);
            }
        }
    });

    it("gives every provider a unique id", () => {
        const ids = LLM_PROVIDERS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
