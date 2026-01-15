// Shared types and utilities for grouping items by aisle and section

export interface GroupedDisplayItem {
    id: string;
    name: string;
    aisleId: string | null;
    sectionId: string | null;
    aisleName?: string | null;
    sectionName?: string | null;
    aisleSortOrder?: number | null;
    sectionSortOrder?: number | null;
}

export interface AisleGroup<T extends GroupedDisplayItem = GroupedDisplayItem> {
    aisleId: string | null;
    aisleName: string | null;
    aisleSortOrder: number | null;
    sections: SectionGroup<T>[];
}

export interface SectionGroup<T extends GroupedDisplayItem = GroupedDisplayItem> {
    sectionId: string | null;
    sectionName: string | null;
    sectionSortOrder: number | null;
    items: T[];
}

/**
 * Groups items by aisle and section, sorted by their sortOrder values.
 * Null aisles/sections appear at the top.
 */
export function groupItemsByLocation<T extends GroupedDisplayItem>(items: T[]): AisleGroup<T>[] {
    const aisleMap = new Map<string | null, Map<string | null, T[]>>();

    for (const item of items) {
        const aisleKey = item.aisleId;
        const sectionKey = item.sectionId;

        if (!aisleMap.has(aisleKey)) {
            aisleMap.set(aisleKey, new Map());
        }

        const sectionMap = aisleMap.get(aisleKey)!;
        if (!sectionMap.has(sectionKey)) {
            sectionMap.set(sectionKey, []);
        }

        sectionMap.get(sectionKey)!.push(item);
    }

    // Convert to array structure and sort by aisleSortOrder
    // Put null aisles (uncategorized) at the top
    const sortedAisles = Array.from(aisleMap.entries()).sort((a, b) => {
        const aisleA = items.find((item) => item.aisleId === a[0]);
        const aisleB = items.find((item) => item.aisleId === b[0]);
        const sortOrderA = aisleA?.aisleSortOrder ?? 999999;
        const sortOrderB = aisleB?.aisleSortOrder ?? 999999;
        return sortOrderA - sortOrderB;
    });

    const result: AisleGroup<T>[] = [];

    for (const [aisleId, sectionMap] of sortedAisles) {
        const aisleItem = items.find((item) => item.aisleId === aisleId);

        const sections: SectionGroup<T>[] = [];

        // Sort sections by sectionSortOrder
        const sortedSections = Array.from(sectionMap.entries()).sort((a, b) => {
            const sectionA = items.find((item) => item.sectionId === a[0]);
            const sectionB = items.find((item) => item.sectionId === b[0]);
            const sortOrderA = sectionA?.sectionSortOrder ?? 999999;
            const sortOrderB = sectionB?.sectionSortOrder ?? 999999;
            return sortOrderA - sortOrderB;
        });

        for (const [sectionId, sectionItems] of sortedSections) {
            const sectionItem = items.find((item) => item.sectionId === sectionId);

            sections.push({
                sectionId,
                sectionName: sectionItem?.sectionName || null,
                sectionSortOrder: sectionItem?.sectionSortOrder || null,
                items: sectionItems,
            });
        }

        result.push({
            aisleId: aisleId,
            aisleName: aisleItem?.aisleName || null,
            aisleSortOrder: aisleItem?.aisleSortOrder || null,
            sections,
        });
    }

    return result;
}
