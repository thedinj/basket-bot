/**
 * Auto-categorization feature for shopping list items
 */

import type { StoreAisle, StoreSection } from "@basket-bot/core";

export interface AutoCategorizeResult {
    aisleName: string;
    sectionName: string | null;
    confidence: number;
    reasoning: string;
}

export interface AutoCategorizeInput {
    itemName: string;
    aisles: Array<{
        name: string;
        sections?: string[]; // Optional: omit if no sections
    }>;
}

/**
 * Validates the LLM response for auto-categorization
 */
export function validateAutoCategorizeResult(data: unknown): data is AutoCategorizeResult {
    if (typeof data !== "object" || data === null) {
        return false;
    }

    const result = data as Record<string, unknown>;

    return (
        typeof result.aisleName === "string" &&
        (typeof result.sectionName === "string" || result.sectionName === null) &&
        typeof result.confidence === "number" &&
        typeof result.reasoning === "string"
    );
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
            (s) => s.aisleId === aisle.id && s.name.toLowerCase() === result.sectionName!.toLowerCase()
        );
        sectionId = section?.id || null;
    }

    return { aisleId: aisle.id, sectionId };
}
