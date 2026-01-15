/**
 * Store Scan Feature - LLM-powered aisle/section extraction
 */

import { naturalSort } from "../../utils/stringUtils";

/**
 * LLM response structure for store directory scan
 */
export interface StoreScanResult {
    aisles: Array<{
        name: string;
        sections: string[];
    }>;
}

/**
 * Transformed data ready for database insertion
 */
export interface TransformedStoreScanData {
    aisles: Array<{
        name: string;
        sortOrder: number;
    }>;
    sections: Array<{
        aisleName: string;
        name: string;
        sortOrder: number;
    }>;
}

/**
 * Transform LLM scan result into database-ready structure
 */
export function transformStoreScanResult(result: StoreScanResult): TransformedStoreScanData {
    const transformed: TransformedStoreScanData = {
        aisles: [],
        sections: [],
    };

    if (!result.aisles || result.aisles.length === 0) {
        throw new Error("No aisles found in scan result");
    }

    // Sort aisles: non-numbered first (alphabetically), then numbered (naturally)
    const sortedAisles = [...result.aisles].sort((a, b) => {
        const aHasNumber = /\d/.test(a.name);
        const bHasNumber = /\d/.test(b.name);

        // Non-numbered aisles come first
        if (!aHasNumber && bHasNumber) return -1;
        if (aHasNumber && !bHasNumber) return 1;

        // Within same group, use natural sort
        return naturalSort<StoreScanResult["aisles"][number]>((x) => x.name)(a, b);
    });

    sortedAisles.forEach((aisle, aisleIndex) => {
        // Add aisle with sortOrder
        transformed.aisles.push({
            name: aisle.name.trim(),
            sortOrder: aisleIndex,
        });

        // Add sections for this aisle
        if (aisle.sections && aisle.sections.length > 0) {
            // Sort sections naturally (case-insensitive, numeric-aware)
            const sortedSections = [...aisle.sections].sort(naturalSort((s) => s));

            sortedSections.forEach((section, sectionIndex) => {
                transformed.sections.push({
                    aisleName: aisle.name.trim(),
                    name: section.trim(),
                    sortOrder: sectionIndex,
                });
            });
        }
    });

    return transformed;
}

/**
 * Validate that the scan result has the expected structure
 */
export function validateStoreScanResult(data: unknown): data is StoreScanResult {
    if (!data || typeof data !== "object") {
        return false;
    }

    const result = data as StoreScanResult;

    if (!Array.isArray(result.aisles)) {
        return false;
    }

    for (const aisle of result.aisles) {
        if (typeof aisle.name !== "string" || !aisle.name.trim()) {
            return false;
        }
        if (!Array.isArray(aisle.sections)) {
            return false;
        }
        for (const section of aisle.sections) {
            if (typeof section !== "string") {
                return false;
            }
        }
    }

    return true;
}
