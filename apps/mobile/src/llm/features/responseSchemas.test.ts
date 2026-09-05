/**
 * The response schemas are the only thing standing between an LLM's output and code that
 * indexes into it. These cases mirror the shapes the previous hand-written type guards
 * accepted and rejected, so the Zod rewrite cannot silently loosen or tighten validation.
 */

import { describe, expect, it } from "vitest";
import { autoCategorizeResultSchema } from "./autoCategorize";
import { bulkImportResponseSchema } from "./bulkImport";
import { recipeImportResponseSchema } from "./recipeImport";
import { storeScanResultSchema } from "./storeScan";

describe("bulkImportResponseSchema", () => {
    it("accepts items with null quantity, unit and notes", () => {
        const result = bulkImportResponseSchema.safeParse({
            items: [{ name: "Milk", quantity: null, unit: null, notes: null }],
        });
        expect(result.success).toBe(true);
    });

    it("accepts an empty list", () => {
        expect(bulkImportResponseSchema.safeParse({ items: [] }).success).toBe(true);
    });

    it("rejects a missing items array", () => {
        expect(bulkImportResponseSchema.safeParse({}).success).toBe(false);
    });

    it("rejects an item whose quantity came back as a string", () => {
        const result = bulkImportResponseSchema.safeParse({
            items: [{ name: "Milk", quantity: "2", unit: null, notes: null }],
        });
        expect(result.success).toBe(false);
    });
});

describe("recipeImportResponseSchema", () => {
    const recipe = {
        name: "Chili",
        source: null,
        description: null,
        steps: null,
        cookingTimeMinutes: 45,
        ingredients: [{ name: "Beans", qty: 2, unit: "can" }],
    };

    it("accepts a recipe whose optional shopping fields are absent", () => {
        expect(recipeImportResponseSchema.safeParse({ recipe }).success).toBe(true);
    });

    it("accepts the optional exclusion and shopping overrides", () => {
        const result = recipeImportResponseSchema.safeParse({
            recipe: {
                ...recipe,
                ingredients: [
                    {
                        name: "Beans",
                        qty: 2,
                        unit: "can",
                        shoppingName: "Kidney beans",
                        shoppingQty: 1,
                        shoppingUnit: "tin",
                        excluded: true,
                    },
                ],
            },
        });
        expect(result.success).toBe(true);
    });

    it("rejects an empty recipe name", () => {
        const result = recipeImportResponseSchema.safeParse({ recipe: { ...recipe, name: "" } });
        expect(result.success).toBe(false);
    });

    it("rejects an ingredient with an empty name", () => {
        const result = recipeImportResponseSchema.safeParse({
            recipe: { ...recipe, ingredients: [{ name: "", qty: null, unit: null }] },
        });
        expect(result.success).toBe(false);
    });
});

describe("autoCategorizeResultSchema", () => {
    it("accepts a null section, which means aisle-only placement", () => {
        const result = autoCategorizeResultSchema.safeParse({
            aisleName: "Dairy",
            sectionName: null,
            confidence: 0.9,
            reasoning: "Milk is dairy",
        });
        expect(result.success).toBe(true);
    });

    it("rejects a response missing the reasoning field", () => {
        const result = autoCategorizeResultSchema.safeParse({
            aisleName: "Dairy",
            sectionName: null,
            confidence: 0.9,
        });
        expect(result.success).toBe(false);
    });
});

describe("storeScanResultSchema", () => {
    it("accepts an aisle with no sections", () => {
        const result = storeScanResultSchema.safeParse({ aisles: [{ name: "1", sections: [] }] });
        expect(result.success).toBe(true);
    });

    it("rejects an aisle with an empty name", () => {
        const result = storeScanResultSchema.safeParse({ aisles: [{ name: "", sections: [] }] });
        expect(result.success).toBe(false);
    });

    it("rejects an aisle whose sections are not an array", () => {
        const result = storeScanResultSchema.safeParse({
            aisles: [{ name: "1", sections: "Bread" }],
        });
        expect(result.success).toBe(false);
    });
});
