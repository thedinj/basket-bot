import pluralize from "pluralize";

/**
 * Converts a string to sentence case (first letter capitalized, rest lowercase)
 * Used for formatting LLM output for display consistency
 * @param str - The string to convert
 * @returns The string in sentence case
 */
export const toSentenceCase = (str: string): string => {
    if (!str || str.length === 0) return str;
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

/**
 * Normalizes an item name for database storage and matching
 * - Converts to singular form (using pluralize library)
 * - Converts to lowercase
 * - Trims whitespace
 *
 * This ensures that "apple", "apples", "Apple", and "Apples" all normalize to "apple"
 * enabling proper matching while preserving the user's original input in the display name.
 *
 * @param name - The item name to normalize
 * @returns The normalized name for storage in nameNorm field
 */
export const normalizeItemName = (name: string): string => {
    const trimmed = name.trim();
    const singular = pluralize.singular(trimmed);
    return singular.toLowerCase();
};

/**
 * Normalizes a raw unit string from LLM output for matching against known units.
 * Removes punctuation, singularizes, and lowercases.
 */
const normalizeUnit = (unit: string): string =>
    pluralize
        .singular(unit.replace(/[^\w\s]/g, ""))
        .toLowerCase()
        .trim();

/**
 * Matches a raw unit string against known units and returns the matching unit ID,
 * or null if the unit is not recognized. Matches by abbreviation or name.
 */
export const matchUnitId = (
    unitStr: string | null | undefined,
    units: Array<{ id: string; abbreviation: string; name: string }> | undefined
): string | null => {
    if (!unitStr || !units) return null;
    const normalized = normalizeUnit(unitStr);
    return (
        units.find(
            (u) =>
                normalizeUnit(u.abbreviation) === normalized || normalizeUnit(u.name) === normalized
        )?.id ?? null
    );
};

/**
 * Returns a sort function for Array.prototype.sort that sorts objects naturally by a mapped string property.
 *
 * @param mapFn - Function to map an object to a string for comparison
 * @returns Sort function for use as .sort(objectSortFn(mapFn))
 */
export const naturalSort = <T>(mapFn: (obj: T) => string): ((a: T, b: T) => number) => {
    const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
    });
    return (a: T, b: T) => collator.compare(mapFn(a), mapFn(b));
};
