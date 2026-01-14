/**
 * Auto-categorization feature for shopping list items
 */

export interface AutoCategorizeResult {
    aisle_name: string;
    section_name: string | null;
    confidence: number;
    reasoning: string;
}

export interface AutoCategorizeInput {
    item_name: string;
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
export function validateAutoCategorizeResult(
    data: unknown
): data is AutoCategorizeResult {
    if (typeof data !== "object" || data === null) {
        return false;
    }

    const result = data as Record<string, unknown>;

    return (
        typeof result.aisle_name === "string" &&
        (typeof result.section_name === "string" ||
            result.section_name === null) &&
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
    const aisle = aisles.find(
        (a) => a.name.toLowerCase() === result.aisle_name.toLowerCase()
    );

    if (!aisle) {
        return { aisleId: null, sectionId: null };
    }

    // Find matching section if provided
    let sectionId: string | null = null;
    if (result.section_name) {
        const section = aisle.sections.find(
            (s) => s.name.toLowerCase() === result.section_name!.toLowerCase()
        );
        sectionId = section?.id || null;
    }

    return { aisleId: aisle.id, sectionId };
}
