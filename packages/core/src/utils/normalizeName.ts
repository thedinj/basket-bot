import pluralize from "pluralize";

/**
 * Name normalization, shared by both apps.
 *
 * These two functions used to be one function named `normalizeItemName`, defined separately in
 * `apps/backend/src/lib/utils/stringUtils.ts` and `apps/mobile/src/utils/stringUtils.ts` — with
 * *different* behavior. The backend version (which writes every stored `nameNorm`) collapsed
 * whitespace; the mobile version singularized instead. Client code that compared its own
 * normalized text against a server-written `nameNorm` therefore missed on any plural: importing
 * "Apples" against a stored `"apples"` looked like a new item and created a duplicate.
 *
 * They are now two explicitly different things, so a call site has to say which it means.
 */

/**
 * The storage and uniqueness key: what gets written to `nameNorm` and what the
 * `UNIQUE (storeId, nameNorm)` constraints compare.
 *
 * Trims, lowercases, and collapses internal whitespace runs, so "Spices", " Spices" and
 * "Spi  ces" are one name. Deliberately does **not** singularize — "Apple" and "Apples" are
 * distinct items a user is entitled to keep apart, and changing that would invalidate every
 * `nameNorm` already stored and collide on stores that hold both.
 *
 * Use this whenever you are comparing against, or producing, a persisted `nameNorm`.
 */
export function normalizeItemName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The lenient, display-side variant: everything `normalizeItemName` does, plus singularization,
 * so typing "apples" finds "Apple".
 *
 * For filtering and ranking lists in the UI only. Apply it to **both** sides of a comparison —
 * never compare its output against a stored `nameNorm`, which is not singularized.
 */
export function normalizeForSearch(name: string): string {
    return pluralize.singular(normalizeItemName(name));
}
