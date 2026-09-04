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
 * Name normalization now lives in `@basket-bot/core` so the client and the backend that writes
 * `nameNorm` cannot disagree. Re-exported here because ~a dozen call sites import it from this
 * module.
 *
 * - `normalizeItemName` — the storage/uniqueness key. Use it to compare against a `nameNorm`.
 * - `normalizeForSearch` — lenient, singularizing, for filtering lists in the UI. Apply it to
 *   both sides of a comparison and never against a stored `nameNorm`.
 */
export { normalizeForSearch, normalizeItemName } from "@basket-bot/core";

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
