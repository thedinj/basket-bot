import { IonContent, IonSkeletonText } from "@ionic/react";
import { GroupedItemList } from "../shared/GroupedItemList";
import type { ItemGroup } from "../shared/grouping.types";
import { SkeletonListItem } from "../shared/skeleton/SkeletonListItem";
import "./ShoppingListSkeleton.scss";

interface SkeletonPlaceholder {
    id: string;
    /** Bar widths for the row: a title, then an optional notes line. */
    widths: string[];
}

// Same values the real list uses (GroupedShoppingList / grouping.utils): every aisle header is
// a sticky "light" bar with the plate column and the road-sign label class.
const AISLE_LABEL_CLASS = "group-header-label group-header-label--aisle";
const SECTION_LABEL_CLASS = "group-header-label group-header-label--section";

const rows = (groupId: string, widths: string[][]): SkeletonPlaceholder[] =>
    widths.map((rowWidths, index) => ({ id: `${groupId}-${index}`, widths: rowWidths }));

// The plate placeholder fills the 36x28 plate; the plate's own outline is made transparent
// (badgeColor) so only the shimmer shows.
const aisleHeader = (
    labelWidth: string
): NonNullable<ItemGroup<SkeletonPlaceholder>["header"]> => ({
    label: (
        <IonSkeletonText
            animated
            className="shopping-skeleton__aisle"
            style={{ width: labelWidth }}
        />
    ),
    badge: <IonSkeletonText animated className="shopping-skeleton__plate" />,
    badgeColor: "transparent",
    color: "light",
    sticky: true,
    labelClassName: AISLE_LABEL_CLASS,
});

const sectionGroup = (
    id: string,
    sortOrder: number,
    labelWidth: string | null,
    widths: string[][]
): ItemGroup<SkeletonPlaceholder> => ({
    id,
    items: rows(id, widths),
    sortOrder,
    header: labelWidth
        ? {
              label: (
                  <IonSkeletonText
                      animated
                      className="shopping-skeleton__section"
                      style={{ width: labelWidth }}
                  />
              ),
              labelClassName: SECTION_LABEL_CLASS,
          }
        : undefined,
});

// One aisle split into two sections, then one aisle of loose items: the three header levels
// the real list shows, with rows of uneven length (some carrying a notes line).
const SKELETON_GROUPS: ItemGroup<SkeletonPlaceholder>[] = [
    {
        id: "skeleton-aisle-1",
        items: [],
        sortOrder: 0,
        header: aisleHeader("7.5rem"),
        children: [
            sectionGroup("skeleton-section-1", 0, "4.5rem", [["58%"], ["42%", "30%"]]),
            sectionGroup("skeleton-section-2", 1, "3.5rem", [["66%"], ["48%"]]),
        ],
    },
    {
        id: "skeleton-aisle-2",
        items: [],
        sortOrder: 1,
        header: aisleHeader("5.5rem"),
        children: [sectionGroup("skeleton-section-3", 0, null, [["52%"], ["70%", "36%"], ["40%"]])],
    },
];

const getItemKey = (item: SkeletonPlaceholder) => item.id;

const renderSkeletonRow = (item: SkeletonPlaceholder) => (
    <SkeletonListItem
        startSlot={<IonSkeletonText animated className="shopping-skeleton__checkbox" />}
        widths={item.widths}
    />
);

/**
 * Content-shaped fallback for the shopping list's Suspense boundary — reuses the same
 * GroupedItemList shell (headers, indentation, mount animation) the real list renders
 * through, rather than hand-duplicating that layout, so it can't drift out of sync. Plates,
 * checkboxes and text bars land on the real columns: aisle and section text at x = 62, item
 * text at x = 78.
 *
 * Wrapped in its own IonContent (matching ShoppingListBody's real wrapper) since this
 * fallback replaces ShoppingListBody entirely while suspended — without it, the skeleton
 * renders as a bare list outside Ionic's content-sizing layout instead of filling the page.
 */
const ShoppingListSkeleton: React.FC = () => (
    <IonContent className="shopping-list-content shopping-skeleton" aria-busy="true">
        <span className="sr-only" role="status">
            Loading the list.
        </span>
        <div aria-hidden="true">
            <GroupedItemList<SkeletonPlaceholder>
                groups={SKELETON_GROUPS}
                getItemKey={getItemKey}
                renderItem={renderSkeletonRow}
            />
        </div>
    </IonContent>
);

export default ShoppingListSkeleton;
