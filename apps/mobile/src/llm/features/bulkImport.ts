/**
 * Bulk shopping list import types and functions
 */

export interface ParsedShoppingItem {
    name: string;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
}

export interface BulkImportResponse {
    items: ParsedShoppingItem[];
}

/**
 * Validates the LLM response for bulk import
 */
export function validateBulkImportResult(
    data: unknown
): data is BulkImportResponse {
    if (typeof data !== "object" || data === null) {
        return false;
    }

    const response = data as Record<string, unknown>;

    if (!Array.isArray(response.items)) {
        return false;
    }

    return response.items.every((item) => {
        if (typeof item !== "object" || item === null) {
            return false;
        }

        const parsed = item as Record<string, unknown>;

        return (
            typeof parsed.name === "string" &&
            (typeof parsed.quantity === "number" || parsed.quantity === null) &&
            (typeof parsed.unit === "string" || parsed.unit === null) &&
            (typeof parsed.notes === "string" || parsed.notes === null)
        );
    });
}
