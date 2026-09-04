/**
 * Auto-categorization feature for shopping list items
 */

import type { StoreAisle, StoreSection } from "@basket-bot/core";
import { z } from "zod";

export const autoCategorizeResultSchema = z.object({
    aisleName: z.string(),
    sectionName: z.string().nullable(),
    confidence: z.number(),
    reasoning: z.string(),
});

export type AutoCategorizeResult = z.infer<typeof autoCategorizeResultSchema>;

export interface AutoCategorizeInput {
    itemName: string;
    aisles: Array<{
        name: string;
        sections?: string[]; // Optional: omit if no sections
    }>;
}

/**
 * Transforms LLM response to actual aisle/section IDs
 * @param result - The LLM's categorization result
 * @param aisles - Full aisle data from database (with IDs)
 * @param sections - Full section data from database (with IDs)
 */
export function transformAutoCategorizeResult(
    result: AutoCategorizeResult,
    aisles: StoreAisle[],
    sections: StoreSection[]
): { aisleId: string | null; sectionId: string | null } {
    // Find matching aisle (case-insensitive)
    const aisle = aisles.find((a) => a.name.toLowerCase() === result.aisleName.toLowerCase());

    if (!aisle) {
        return { aisleId: null, sectionId: null };
    }

    // Find matching section if provided
    let sectionId: string | null = null;
    if (result.sectionName) {
        const section = sections.find(
            (s) =>
                s.aisleId === aisle.id && s.name.toLowerCase() === result.sectionName!.toLowerCase()
        );
        sectionId = section?.id || null;
    }

    return { aisleId: aisle.id, sectionId };
}
