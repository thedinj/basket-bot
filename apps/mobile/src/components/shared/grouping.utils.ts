import { ItemGroup } from "./grouping.types";

/**
 * Base interface that items must satisfy to be grouped by aisle/section
 */
interface GroupableItem {
    id: number | string;
    aisle_id: number | string | null;
    section_id: number | string | null;
    aisle_name?: string | null;
    section_name?: string | null;
    aisle_sort_order?: number | null;
    section_sort_order?: number | null;
}

/**
 * Configuration for creating hierarchical aisle/section groups
 */
interface AisleSectionGroupConfig {
    /**
     * Whether to create aisle-level groups with headers
     */
    showAisleHeaders: boolean;

    /**
     * Whether to create section-level groups with headers
     */
    showSectionHeaders: boolean;

    /**
     * Base sort order offset for these groups (allows interleaving with other group types)
     */
    sortOrderOffset?: number;

    /**
     * Indent level for items within sections (in pixels)
     */
    sectionIndentLevel?: number;
}

interface AisleGroupInternal {
    aisle_id: number | string | null;
    aisle_name: string;
    aisle_sort_order: number;
    sections: SectionGroupInternal[];
}

interface SectionGroupInternal {
    section_id: number | string | null;
    section_name: string;
    section_sort_order: number;
    items: GroupableItem[];
}

/**
 * Converts items grouped by aisle/section into nested ItemGroup structure
 */
export function createAisleSectionGroups<T extends GroupableItem>(
    items: T[],
    config: AisleSectionGroupConfig
): ItemGroup<T>[] {
    const {
        showAisleHeaders,
        showSectionHeaders,
        sortOrderOffset = 0,
        sectionIndentLevel = 16,
    } = config;

    // Group items by aisle and section
    const aisleMap = new Map<number | string | null, AisleGroupInternal>();

    for (const item of items) {
        const aisleId = item.aisle_id;
        const sectionId = item.section_id;
        const aisleName = item.aisle_name || "Uncategorized";
        const sectionName = item.section_name || "Uncategorized";
        const aisleSortOrder =
            aisleId === null ? -1 : item.aisle_sort_order ?? 0;
        const sectionSortOrder =
            sectionId === null ? -1 : item.section_sort_order ?? 0;

        let aisleGroup = aisleMap.get(aisleId);
        if (!aisleGroup) {
            aisleGroup = {
                aisle_id: aisleId,
                aisle_name: aisleName,
                aisle_sort_order: aisleSortOrder,
                sections: [],
            };
            aisleMap.set(aisleId, aisleGroup);
        }

        let sectionGroup = aisleGroup.sections.find(
            (s) => s.section_id === sectionId
        );
        if (!sectionGroup) {
            sectionGroup = {
                section_id: sectionId,
                section_name: sectionName,
                section_sort_order: sectionSortOrder,
                items: [],
            };
            aisleGroup.sections.push(sectionGroup);
        }

        sectionGroup.items.push(item);
    }

    // Sort aisles and sections
    const sortedAisles = Array.from(aisleMap.values()).sort((a, b) => {
        const aIsUncategorized = a.aisle_id === null;
        const bIsUncategorized = b.aisle_id === null;
        if (aIsUncategorized && !bIsUncategorized) return -1;
        if (!aIsUncategorized && bIsUncategorized) return 1;
        return a.aisle_sort_order - b.aisle_sort_order;
    });

    for (const aisle of sortedAisles) {
        aisle.sections.sort((a, b) => {
            const aIsUncategorized = a.section_id === null;
            const bIsUncategorized = b.section_id === null;
            if (aIsUncategorized && !bIsUncategorized) return -1;
            if (!aIsUncategorized && bIsUncategorized) return 1;
            return a.section_sort_order - b.section_sort_order;
        });
    }

    // Convert to ItemGroup structure
    const groups: ItemGroup<T>[] = [];
    let groupIndex = 0;

    for (const aisle of sortedAisles) {
        const aisleGroup: ItemGroup<T> = {
            id: `aisle-${aisle.aisle_id}`,
            items: [],
            sortOrder: sortOrderOffset + groupIndex++,
            children: [],
        };

        // Add aisle header if configured
        if (showAisleHeaders) {
            aisleGroup.header = {
                label: aisle.aisle_name,
                color: "light",
                sticky: true,
                labelStyle: {
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                },
            };
        }

        // Create section groups as children
        for (const section of aisle.sections) {
            const sectionGroup: ItemGroup<T> = {
                id: `section-${section.section_id}`,
                items: section.items as T[],
                sortOrder: section.section_sort_order,
                indentLevel: showSectionHeaders ? sectionIndentLevel : 0,
            };

            // Add section header if configured and not uncategorized
            if (showSectionHeaders && section.section_id !== null) {
                sectionGroup.header = {
                    label: section.section_name,
                    color: "light",
                    labelStyle: {
                        fontSize: "0.85rem",
                        fontWeight: "500",
                        opacity: 0.9,
                    },
                };
            }

            aisleGroup.children!.push(sectionGroup);
        }

        groups.push(aisleGroup);
    }

    return groups;
}

/**
 * Flattens a nested group structure into a single-level array
 * Useful for operations that need to process all items linearly
 */
export function flattenGroups<T>(groups: ItemGroup<T>[]): ItemGroup<T>[] {
    const flattened: ItemGroup<T>[] = [];

    for (const group of groups) {
        flattened.push(group);
        if (group.children && group.children.length > 0) {
            flattened.push(...flattenGroups(group.children));
        }
    }

    return flattened;
}
