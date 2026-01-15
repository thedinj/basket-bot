/**
 * Auto-categorization feature for shopping list items
 */

export interface AutoCategorizeResult {
    aisleName: string;
    sectionName: string | null;
    confidence: number;
    reasoning: string;
}

export interface AutoCategorizeInput {
    itemName: string;
    aisles: Array<{
        id: string;
        name: string;
        sections: Array<{
            id: string;
            name: string;
        }>;
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
 */
export function transformAutoCategorizeResult(
    result: AutoCategorizeResult,
    aisles: AutoCategorizeInput["aisles"]
): { aisleId: string | null; sectionId: string | null } {
    // Find matching aisle (case-insensitive)
    const aisle = aisles.find((a) => a.name.toLowerCase() === result.aisleName.toLowerCase());

    if (!aisle) {
        return { aisleId: null, sectionId: null };
    }

    // Find matching section if provided
    let sectionId: string | null = null;
    if (result.sectionName) {
        const section = aisle.sections.find(
            (s) => s.name.toLowerCase() === result.sectionName!.toLowerCase()
        );
        sectionId = section?.id || null;
    }

    return { aisleId: aisle.id, sectionId };
}
