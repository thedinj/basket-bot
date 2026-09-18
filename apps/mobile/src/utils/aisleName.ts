/**
 * An aisle name split into the number printed on the store's sign (if the name carries one)
 * and the remaining descriptive label. Drives the "shield" aisle header.
 */
export type ParsedAisleName = {
    /** The aisle number as printed ("12", "14B"), or null when the name has none. */
    code: string | null;
    /** What's left once the number is removed; empty for a bare number ("12", "Aisle 12"). */
    label: string;
};

// Leading: "12", "#5 Paper goods", "Aisle 7: Baking", "3 - Cereal". The negative lookahead stops
// "1st floor" from reading as aisle 1.
const LEADING = /^(?:aisle\s*)?#?\s*(\d{1,3}[a-z]?)(?![a-z\d])[\s\-–—:.|·/)]*(.*)$/i;
// Trailing, only with the word "aisle": "Snacks (Aisle 9)", "Snacks - aisle 9".
const TRAILING = /^(.*?)[\s\-–—:,(|]*aisle\s*#?\s*(\d{1,3}[a-z]?)\)?\s*$/i;

/**
 * Deliberately conservative: a number must lead the name or trail it as "Aisle N". Anything
 * else is treated as a plain name with no number.
 */
export const parseAisleName = (name: string): ParsedAisleName => {
    const trimmed = name.trim();

    const leading = trimmed.match(LEADING);
    if (leading) {
        return { code: leading[1].toUpperCase(), label: leading[2].trim() };
    }

    const trailing = trimmed.match(TRAILING);
    if (trailing && trailing[1].trim()) {
        return { code: trailing[2].toUpperCase(), label: trailing[1].trim() };
    }

    return { code: null, label: trimmed };
};
