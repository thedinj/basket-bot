/**
 * Emoji validation for aisle plates.
 *
 * An aisle's emoji must be exactly one user-perceived character (one grapheme: a ZWJ sequence
 * like 🧑‍🍳 or a flag like 🇺🇸 counts as one) that is actually pictographic — not a letter,
 * digit, or a word the LLM returned instead of an emoji.
 */

// Longest real emoji sequences (family ZWJ + skin tones) run to ~35 UTF-16 code units.
export const MAX_EMOJI_LENGTH = 40;

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

const graphemes = (value: string): string[] => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (s) => s.segment);
};

/** True when `value` (ignoring surrounding whitespace) is a single emoji. */
export const isSingleEmoji = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_EMOJI_LENGTH) return false;
    const parts = graphemes(trimmed);
    return parts.length === 1 && PICTOGRAPHIC.test(parts[0]);
};

/** The trimmed emoji when valid, otherwise null. For LLM output, where a bad value is dropped. */
export const toSingleEmojiOrNull = (value: string | null | undefined): string | null =>
    value && isSingleEmoji(value) ? value.trim() : null;
