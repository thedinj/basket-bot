/**
 * Normalize a name for case-insensitive comparison and uniqueness checking.
 * Trims, lowercases, and collapses internal whitespace runs to a single space
 * so e.g. "Spices" and " Spices" (or "Spi  ces") are treated as duplicates.
 * Shared by items, sections, and aisles.
 */
export function normalizeItemName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}
