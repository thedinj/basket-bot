/**
 * Store Scan Feature - LLM-powered aisle/section extraction
 */

import { FUZZY_MATCH_THRESHOLD, fuzzyMatch } from "../../utils/stringMatch";
import { naturalSort } from "../../utils/stringUtils";

/**
 * Existing aisle data from database
 */
export interface ExistingAisle {
    id: string;
    name: string;
}

/**
 * Existing section data from database
 */
export interface ExistingSection {
    id: string;
    name: string;
}

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
 * Transformed data ready for database insertion/update
 */
export interface TransformedStoreScanData {
    aisles: Array<{
        id?: string; // Present if matched existing aisle
        name: string;
        sortOrder: number;
    }>;
    sections: Array<{
        id?: string; // Present if matched existing section
        aisleName: string;
        name: string;
        sortOrder: number;
    }>;
}

/**
 * Transform LLM scan result into database-ready structure with fuzzy matching
 * for existing aisles/sections.
 *
 * @param result - LLM scan result containing aisles and sections
 * @param existingAisles - Current aisles in database (for ID preservation)
 * @param existingSections - Current sections in database (for ID preservation)
 * @returns Transformed data with IDs for matched entities
 */
export function transformStoreScanResult(
    result: StoreScanResult,
    existingAisles: ExistingAisle[] = [],
    existingSections: ExistingSection[] = []
): TransformedStoreScanData {
    const transformed: TransformedStoreScanData = {
        aisles: [],
        sections: [],
    };

    if (!result.aisles || result.aisles.length === 0) {
        throw new Error("No aisles found in scan result");
    }

    // Helper: Find matching aisle by fuzzy name match
    const findMatchingAisle = (llmName: string): string | undefined => {
        for (const existing of existingAisles) {
            if (fuzzyMatch(llmName, existing.name, FUZZY_MATCH_THRESHOLD)) {
                return existing.id;
            }
        }
        return undefined;
    };

    // Helper: Find matching section by fuzzy name match (global search)
    const findMatchingSection = (llmName: string): string | undefined => {
        for (const existing of existingSections) {
            if (fuzzyMatch(llmName, existing.name, FUZZY_MATCH_THRESHOLD)) {
                return existing.id;
            }
        }
        return undefined;
    };

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
        const trimmedAisleName = aisle.name.trim();
        const matchedAisleId = findMatchingAisle(trimmedAisleName);

        // Add aisle with sortOrder (and ID if matched)
        transformed.aisles.push({
            id: matchedAisleId,
            name: trimmedAisleName,
            sortOrder: aisleIndex,
        });

        // Add sections for this aisle
        if (aisle.sections && aisle.sections.length > 0) {
            // Sort sections naturally (case-insensitive, numeric-aware)
            const sortedSections = [...aisle.sections].sort(naturalSort((s) => s));

            sortedSections.forEach((section, sectionIndex) => {
                const trimmedSectionName = section.trim();
                const matchedSectionId = findMatchingSection(trimmedSectionName);

                transformed.sections.push({
                    id: matchedSectionId,
                    aisleName: trimmedAisleName,
                    name: trimmedSectionName,
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
