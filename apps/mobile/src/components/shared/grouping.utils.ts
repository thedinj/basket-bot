import { parseAisleName } from "../../utils/aisleName";
import { ItemGroup } from "./grouping.types";

/**
 * Base interface that items must satisfy to be grouped by aisle/section
 */
interface GroupableItem {
    id: number | string;
    aisleId: number | string | null;
    sectionId: number | string | null;
    aisleName?: string | null;
    aisleEmoji?: string | null;
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
    aisleEmoji: string | null;
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
 * What an aisle header shows in its plate and beside it:
 *  1. an emoji set on the aisle → the emoji; the full name beside it ("7 – Baking" keeps its
 *     number, since the plate no longer carries it)
 *  2. a number and a name ("7 – Baking") → the number, then "Baking"
 *  3. a number only ("12", "Aisle 3") → a sign plate reading "AISLE 3", nothing beside it
 *  4. neither (a named aisle without an emoji, or Uncategorized) → an empty, space-holding plate
 */
export const aislePlate = (aisle: {
    aisleId: number | string | null;
    aisleName: string;
    aisleEmoji: string | null;
}): { badge: string; badgeKind: "code" | "emoji" | "sign"; label: string } => {
    if (aisle.aisleId === null) return { badge: "", badgeKind: "code", label: aisle.aisleName };
    if (aisle.aisleEmoji) {
        return { badge: aisle.aisleEmoji, badgeKind: "emoji", label: aisle.aisleName };
    }
    const { code, label } = parseAisleName(aisle.aisleName);
    if (code && !label) return { badge: code, badgeKind: "sign", label: "" };
    return { badge: code ?? "", badgeKind: "code", label };
};

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
                aisleEmoji: aisleId ? (item.aisleEmoji ?? null) : null,
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

        // Add aisle header if configured. Every aisle header gets the plate column, filled or
        // not, so names line up down the list. See `aislePlate` for what goes in it.
        if (showAisleHeaders) {
            const plate = aislePlate(aisle);
            aisleGroup.header = {
                label: plate.label,
                badge: plate.badge,
                badgeKind: plate.badgeKind,
                color: "light",
                sticky: true,
                labelClassName: "group-header-label group-header-label--aisle",
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

            // Every named section gets its own ruled header, even when it's the aisle's only
            // one; the null section (loose items) never does.
            if (showSectionHeaders && section.sectionId !== null) {
                sectionGroup.header = {
                    label: section.sectionName,
                    labelClassName: "group-header-label group-header-label--section",
                };
            }

            aisleGroup.children!.push(sectionGroup);
        }

        groups.push(aisleGroup);
    }

    return groups;
}
