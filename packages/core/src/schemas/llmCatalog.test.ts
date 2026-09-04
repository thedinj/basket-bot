/**
 * The catalogue crosses a version boundary — a phone running an old build parses whatever
 * the backend happens to serve — so the schema is the contract, and these tests pin the
 * parts of it that a well-meaning edit could quietly loosen.
 */

import { describe, expect, it } from "vitest";
import { LLM_TIERS, llmCatalogSchema, llmModelOptionSchema, llmTierSchema } from "./llmCatalog.js";

const catalog = {
    updatedAt: "2026-09-04",
    providers: [
        {
            providerId: "anthropic",
            defaultModels: { fast: "a", smart: "b", vision: "c" },
            models: [{ id: "a", label: "A", tiers: ["fast", "smart"] }],
        },
    ],
};

describe("llmCatalogSchema", () => {
    it("parses a well-formed catalogue", () => {
        expect(llmCatalogSchema.parse(catalog)).toEqual(catalog);
    });

    it("accepts a catalogue with no providers, so a backend can serve an empty one", () => {
        expect(llmCatalogSchema.parse({ updatedAt: "x", providers: [] }).providers).toEqual([]);
    });

    it("rejects a provider missing a tier default, since every tier must resolve", () => {
        const missing = {
            ...catalog,
            providers: [
                {
                    ...catalog.providers[0],
                    defaultModels: { fast: "a", smart: "b" },
                },
            ],
        };
        expect(llmCatalogSchema.safeParse(missing).success).toBe(false);
    });

    it("rejects an empty model id, which would be sent to the provider verbatim", () => {
        expect(
            llmModelOptionSchema.safeParse({ id: "", label: "A", tiers: ["fast"] }).success
        ).toBe(false);
    });

    it("rejects a model listed for no tier, which no picker could ever show", () => {
        expect(llmModelOptionSchema.safeParse({ id: "a", label: "A", tiers: [] }).success).toBe(
            false
        );
    });

    it("rejects an unknown tier rather than silently dropping it", () => {
        expect(llmTierSchema.safeParse("cheap").success).toBe(false);
    });
});

describe("LLM_TIERS", () => {
    it("lists every tier the schema accepts", () => {
        expect([...LLM_TIERS]).toEqual(["fast", "smart", "vision"]);
    });
});
