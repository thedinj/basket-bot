/**
 * The catalog is hand-edited data that ships straight to phones, so the failure it invites
 * is a typo — a default naming a model that isn't in the list, a tier nobody can pick, a
 * duplicate id shadowing another. None of that throws anywhere; it just quietly breaks a
 * picker or an AI action on someone's device. These tests are the guard.
 *
 * What they cannot check is whether an id exists at the vendor. Verify that by hand.
 */

import { LLM_TIERS, llmCatalogSchema } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { LLM_CATALOG, getLLMCatalog } from "./llmCatalog";

describe("LLM_CATALOG", () => {
    it("satisfies the wire schema clients parse it with", () => {
        expect(llmCatalogSchema.safeParse(LLM_CATALOG).success).toBe(true);
    });

    it("is what the route serves", () => {
        expect(getLLMCatalog()).toBe(LLM_CATALOG);
    });

    it("names each provider once", () => {
        const ids = LLM_CATALOG.providers.map((provider) => provider.providerId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    for (const provider of LLM_CATALOG.providers) {
        describe(provider.providerId, () => {
            it("lists each model id once", () => {
                const ids = provider.models.map((model) => model.id);
                expect(new Set(ids).size).toBe(ids.length);
            });

            it.each(LLM_TIERS)("offers its %s default as a selectable model", (tier) => {
                const model = provider.models.find((m) => m.id === provider.defaultModels[tier]);

                // A default absent from the list would show as "Custom…" the moment a user
                // turned the tier's override on — the picker would disagree with the default.
                expect(model, `${provider.defaultModels[tier]} is not in models[]`).toBeDefined();
                expect(model?.tiers).toContain(tier);
            });

            it.each(LLM_TIERS)("offers at least one model for the %s tier", (tier) => {
                expect(provider.models.some((model) => model.tiers.includes(tier))).toBe(true);
            });
        });
    }
});
