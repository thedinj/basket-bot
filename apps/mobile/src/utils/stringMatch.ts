import { compareTwoStrings } from "string-similarity";

/**
 * Fuzzy match threshold for aisle/section name matching during store scans.
 * 0.7 = 70% similarity - lenient enough to match "Dairy" to "Dairy Products"
 */
export const FUZZY_MATCH_THRESHOLD = 0.7;

/**
 * Normalize a string for consistent matching.
 * Converts to lowercase and trims whitespace.
 */
export function normalizeForMatch(name: string): string {
    return name.toLowerCase().trim();
}

/**
 * Check if two strings are similar enough to be considered a match.
 * Uses Dice coefficient for similarity scoring.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @param threshold - Minimum similarity score (0-1) required for match
 * @returns true if similarity >= threshold
 *
 * @example
 * fuzzyMatch("Dairy", "Dairy Products", 0.7) // true
 * fuzzyMatch("Dairy", "Bakery", 0.7) // false
 */
export function fuzzyMatch(str1: string, str2: string, threshold: number): boolean {
    const normalized1 = normalizeForMatch(str1);
    const normalized2 = normalizeForMatch(str2);

    // Exact match after normalization
    if (normalized1 === normalized2) {
        return true;
    }

    // Fuzzy match using Dice coefficient
    const similarity = compareTwoStrings(normalized1, normalized2);
    return similarity >= threshold;
}
