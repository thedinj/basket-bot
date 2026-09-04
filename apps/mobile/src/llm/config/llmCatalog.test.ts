/**
 * Covers the merge between the served catalogue and the bundled fallbacks.
 *
 * Two failures matter here and neither announces itself. If the merge stops preferring the
 * server's models, changing a default stops reaching users and everything still appears to
 * work — on last year's model. If it stops falling back, an offline device or a backend
 * older than this build has no model to call and every AI feature dies at once.
 */

import type { LLMCatalog } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { getProvider } from "../providers/registry";
import { applyCatalogDefaults, modelsForTier, resolveProviderCatalog } from "./llmCatalog";
import { configForProvider } from "./llmConfig";

const OPENAI = getProvider("openai");

const catalog: LLMCatalog = {
    updatedAt: "2026-09-04",
    providers: [
        {
            providerId: "openai",
            defaultModels: {
                fast: "server-fast",
                smart: "server-smart",
                vision: "server-vision",
            },
            models: [
                { id: "server-fast", label: "Server Fast", tiers: ["fast"] },
                { id: "server-smart", label: "Server Smart", tiers: ["smart", "vision"] },
                { id: "server-vision", label: "Server Vision", tiers: ["vision"] },
            ],
        },
    ],
};

describe("resolveProviderCatalog", () => {
    it("prefers the served entry over the bundled fallback", () => {
        const resolved = resolveProviderCatalog("openai", catalog);

        expect(resolved.defaultModels.fast).toBe("server-fast");
        expect(resolved.defaultModels.fast).not.toBe(OPENAI.defaultModels.fast);
    });

    it("falls back to the bundled models when the catalogue is unavailable", () => {
        for (const unavailable of [null, undefined]) {
            const resolved = resolveProviderCatalog("openai", unavailable);
            expect(resolved.defaultModels).toEqual(OPENAI.defaultModels);
            expect(resolved.models).toEqual(OPENAI.knownModels);
        }
    });

    it("falls back for a provider the catalogue says nothing about", () => {
        // `openai-compatible` points at an arbitrary user-run server, so it is deliberately
        // absent from the served catalogue and must keep its bundled defaults.
        const compatible = getProvider("openai-compatible");
        const resolved = resolveProviderCatalog("openai-compatible", catalog);

        expect(resolved.defaultModels).toEqual(compatible.defaultModels);
        expect(resolved.models).toEqual([]);
    });

    it("takes a provider's entry whole rather than mixing the two sources", () => {
        // A served default with bundled models could leave a default missing from its own
        // picker, which shows up as the field reading "Custom…" for a value nobody typed.
        const resolved = resolveProviderCatalog("openai", catalog);
        expect(resolved.models.map((model) => model.id)).toEqual([
            "server-fast",
            "server-smart",
            "server-vision",
        ]);
    });

    it("does not throw on a provider id no longer in the registry", () => {
        expect(resolveProviderCatalog("removed-provider", catalog).defaultModels).toEqual(
            resolveProviderCatalog("openai", catalog).defaultModels
        );
    });
});

describe("modelsForTier", () => {
    it("offers only the models listed for that tier", () => {
        const resolved = resolveProviderCatalog("openai", catalog);

        expect(modelsForTier(resolved, "fast").map((m) => m.id)).toEqual(["server-fast"]);
        expect(modelsForTier(resolved, "vision").map((m) => m.id)).toEqual([
            "server-smart",
            "server-vision",
        ]);
    });

    it("returns nothing for a provider with no known models", () => {
        const resolved = resolveProviderCatalog("openai-compatible", catalog);
        expect(modelsForTier(resolved, "fast")).toEqual([]);
    });
});

describe("applyCatalogDefaults", () => {
    it("fills every unset tier from the catalogue", () => {
        const effective = applyCatalogDefaults(configForProvider("openai"), catalog);

        expect(effective.models).toEqual({
            fast: "server-fast",
            smart: "server-smart",
            vision: "server-vision",
        });
    });

    it("leaves a genuine override alone", () => {
        const stored = { ...configForProvider("openai"), models: { smart: "mine" } };
        const effective = applyCatalogDefaults(stored, catalog);

        expect(effective.models?.smart).toBe("mine");
        expect(effective.models?.fast).toBe("server-fast");
    });

    it("treats a blank override as unset", () => {
        const stored = { ...configForProvider("openai"), models: { fast: "   " } };
        expect(applyCatalogDefaults(stored, catalog).models?.fast).toBe("server-fast");
    });

    it("does not mutate the stored config it was given", () => {
        // The stored config is what Settings edits and what gets serialized back to
        // Preferences; filling defaults into it in place would re-freeze them on the next save.
        const stored = configForProvider("openai");
        applyCatalogDefaults(stored, catalog);

        expect(stored.models).toEqual({});
    });

    it("produces a complete config even with no catalogue and nothing stored", () => {
        const effective = applyCatalogDefaults({ providerId: "openai" }, null);

        expect(effective.models).toEqual(OPENAI.defaultModels);
    });

    it("honours a base URL override only where the provider allows one", () => {
        const pinned = { ...configForProvider("openai"), baseUrl: "https://evil.example.com" };
        expect(applyCatalogDefaults(pinned, catalog).baseUrl).toBe(OPENAI.defaultBaseUrl);

        const editable = {
            ...configForProvider("openai-compatible"),
            baseUrl: "http://192.168.1.10:1234/v1",
        };
        expect(applyCatalogDefaults(editable, catalog).baseUrl).toBe("http://192.168.1.10:1234/v1");
    });

    it("fills the default host when an editable base URL is left blank", () => {
        const compatible = getProvider("openai-compatible");
        const effective = applyCatalogDefaults(configForProvider("openai-compatible"), catalog);

        expect(effective.baseUrl).toBe(compatible.defaultBaseUrl);
    });
});
