// Shared types and utilities for grouping items by aisle and section

export interface GroupedDisplayItem {
    id: string;
    name: string;
    aisle_id: string | null;
    section_id: string | null;
    aisle_name?: string | null;
    section_name?: string | null;
    aisle_sort_order?: number | null;
    section_sort_order?: number | null;
}

export interface AisleGroup<T extends GroupedDisplayItem = GroupedDisplayItem> {
    aisleId: string | null;
    aisleName: string | null;
    aisleSortOrder: number | null;
    sections: SectionGroup<T>[];
}

export interface SectionGroup<
    T extends GroupedDisplayItem = GroupedDisplayItem
> {
    sectionId: string | null;
    sectionName: string | null;
    sectionSortOrder: number | null;
    items: T[];
}

/**
 * Groups items by aisle and section, sorted by their sort_order values.
 * Null aisles/sections appear at the top.
 */
export function groupItemsByLocation<T extends GroupedDisplayItem>(
    items: T[]
): AisleGroup<T>[] {
    const aisleMap = new Map<string | null, Map<string | null, T[]>>();

    for (const item of items) {
        const aisleKey = item.aisle_id;
        const sectionKey = item.section_id;

        if (!aisleMap.has(aisleKey)) {
            aisleMap.set(aisleKey, new Map());
        }

        const sectionMap = aisleMap.get(aisleKey)!;
        if (!sectionMap.has(sectionKey)) {
            sectionMap.set(sectionKey, []);
        }

        sectionMap.get(sectionKey)!.push(item);
    }

    // Convert to array structure and sort by aisle_sort_order
    // Put null aisles (uncategorized) at the top
    const sortedAisles = Array.from(aisleMap.entries()).sort((a, b) => {
        const aisleA = items.find((item) => item.aisle_id === a[0]);
        const aisleB = items.find((item) => item.aisle_id === b[0]);
        const sortOrderA = aisleA?.aisle_sort_order ?? 999999;
        const sortOrderB = aisleB?.aisle_sort_order ?? 999999;
        return sortOrderA - sortOrderB;
    });

    const result: AisleGroup<T>[] = [];

    for (const [aisleId, sectionMap] of sortedAisles) {
        const aisleItem = items.find((item) => item.aisle_id === aisleId);

        const sections: SectionGroup<T>[] = [];

        // Sort sections by section_sort_order
        const sortedSections = Array.from(sectionMap.entries()).sort((a, b) => {
            const sectionA = items.find((item) => item.section_id === a[0]);
            const sectionB = items.find((item) => item.section_id === b[0]);
            const sortOrderA = sectionA?.section_sort_order ?? 999999;
            const sortOrderB = sectionB?.section_sort_order ?? 999999;
            return sortOrderA - sortOrderB;
        });

        for (const [sectionId, sectionItems] of sortedSections) {
            const sectionItem = items.find(
                (item) => item.section_id === sectionId
            );

            sections.push({
                sectionId,
                sectionName: sectionItem?.section_name || null,
                sectionSortOrder: sectionItem?.section_sort_order || null,
                items: sectionItems,
            });
        }

        result.push({
            aisleId: aisleId,
            aisleName: aisleItem?.aisle_name || null,
            aisleSortOrder: aisleItem?.aisle_sort_order || null,
            sections,
        });
    }

    return result;
}
