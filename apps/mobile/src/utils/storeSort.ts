/**
 * Sorts stores by the user's custom position (ascending), falling back to alphabetical
 * for stores with no custom position. Matches the ordering shown in the store tab bar.
 */
export const sortStoresByPreference = <T extends { sortOrder?: number | null; name: string }>(
    stores: T[]
): T[] => {
    return [...stores].sort((a, b) => {
        const aOrder = a.sortOrder ?? null;
        const bOrder = b.sortOrder ?? null;
        if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
        if (aOrder !== null) return -1;
        if (bOrder !== null) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
};
