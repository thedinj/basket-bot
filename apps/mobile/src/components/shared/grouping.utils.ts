import { ItemGroup } from "./grouping.types";

/**
 * Base interface that items must satisfy to be grouped by aisle/section
 */
interface GroupableItem {
    id: number | string;
    aisleId: number | string | null;
    sectionId: number | string | null;
    aisleName?: string | null;
    sectionName?: string | null;
    aisleSortOrder?: number | null;
    sectionSortOrder?: number | null;
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
    aisleId: number | string | null;
    aisleName: string;
    aisleSortOrder: number;
    sections: SectionGroupInternal[];
}

interface SectionGroupInternal {
    sectionId: number | string | null;
    sectionName: string;
    sectionSortOrder: number;
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
        const aisleId = item.aisleId;
        const sectionId = item.sectionId;
        const aisleName = aisleId ? item.aisleName || "Unknown Aisle" : "Uncategorized";
        const sectionName = sectionId ? item.sectionName || "Unknown Section" : "Uncategorized";
        const aisleSortOrder = aisleId === null ? -1 : (item.aisleSortOrder ?? 0);
        const sectionSortOrder = sectionId === null ? -1 : (item.sectionSortOrder ?? 0);

        let aisleGroup = aisleMap.get(aisleId);
        if (!aisleGroup) {
            aisleGroup = {
                aisleId: aisleId,
                aisleName: aisleName,
                aisleSortOrder: aisleSortOrder,
                sections: [],
            };
            aisleMap.set(aisleId, aisleGroup);
        }

        let sectionGroup = aisleGroup.sections.find((s) => s.sectionId === sectionId);
        if (!sectionGroup) {
            sectionGroup = {
                sectionId: sectionId,
                sectionName: sectionName,
                sectionSortOrder: sectionSortOrder,
                items: [],
            };
            aisleGroup.sections.push(sectionGroup);
        }

        sectionGroup.items.push(item);
    }

    // Sort aisles and sections
    const sortedAisles = Array.from(aisleMap.values()).sort((a, b) => {
        const aIsUncategorized = a.aisleId === null;
        const bIsUncategorized = b.aisleId === null;
        if (aIsUncategorized && !bIsUncategorized) return -1;
        if (!aIsUncategorized && bIsUncategorized) return 1;
        return a.aisleSortOrder - b.aisleSortOrder;
    });

    for (const aisle of sortedAisles) {
        aisle.sections.sort((a, b) => {
            const aIsUncategorized = a.sectionId === null;
            const bIsUncategorized = b.sectionId === null;
            if (aIsUncategorized && !bIsUncategorized) return -1;
            if (!aIsUncategorized && bIsUncategorized) return 1;
            return a.sectionSortOrder - b.sectionSortOrder;
        });
    }

    // Convert to ItemGroup structure
    const groups: ItemGroup<T>[] = [];
    let groupIndex = 0;

    for (const aisle of sortedAisles) {
        const aisleGroup: ItemGroup<T> = {
            id: `aisle-${aisle.aisleId}`,
            items: [],
            sortOrder: sortOrderOffset + groupIndex++,
            children: [],
        };

        // Add aisle header if configured
        if (showAisleHeaders) {
            aisleGroup.header = {
                label: aisle.aisleName,
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
                id: `section-${section.sectionId}`,
                items: section.items as T[],
                sortOrder: section.sectionSortOrder,
                indentLevel: showSectionHeaders ? sectionIndentLevel : 0,
            };

            // Add section header if configured and not uncategorized
            if (showSectionHeaders && section.sectionId !== null) {
                sectionGroup.header = {
                    label: section.sectionName,
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
