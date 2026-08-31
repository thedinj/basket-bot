import { IonContent, IonSkeletonText } from "@ionic/react";
import { GroupedItemList } from "../shared/GroupedItemList";
import type { ItemGroup } from "../shared/grouping.types";
import { SkeletonListItem } from "../shared/skeleton/SkeletonListItem";

interface SkeletonPlaceholder {
    id: string;
}

const makeGroup = (
    id: string,
    itemCount: number,
    sortOrder: number
): ItemGroup<SkeletonPlaceholder> => ({
    id,
    items: Array.from({ length: itemCount }, (_, index) => ({ id: `${id}-${index}` })),
    header: {
        label: <IonSkeletonText animated style={{ width: "90px" }} />,
        color: "light",
        sticky: true,
    },
    sortOrder,
    indentLevel: 16,
});

const SKELETON_GROUPS: ItemGroup<SkeletonPlaceholder>[] = [
    makeGroup("skeleton-group-1", 3, 0),
    makeGroup("skeleton-group-2", 2, 1),
];

const getItemKey = (item: SkeletonPlaceholder) => item.id;

const renderSkeletonRow = () => (
    <SkeletonListItem
        startSlot={
            <IonSkeletonText
                animated
                style={{ width: "22px", height: "22px", borderRadius: "50%", margin: 0 }}
            />
        }
        widths={["70%", "40%"]}
    />
);

/**
 * Content-shaped fallback for the shopping list's Suspense boundary — reuses the same
 * GroupedItemList shell (headers, indentation, mount animation) the real list renders
 * through, rather than hand-duplicating that layout, so it can't drift out of sync.
 *
 * Wrapped in its own IonContent (matching ShoppingListBody's real wrapper) since this
 * fallback replaces ShoppingListBody entirely while suspended — without it, the skeleton
 * renders as a bare list outside Ionic's content-sizing layout instead of filling the page.
 */
const ShoppingListSkeleton: React.FC = () => (
    <IonContent fullscreen className="shopping-list-content">
        <GroupedItemList<SkeletonPlaceholder>
            groups={SKELETON_GROUPS}
            getItemKey={getItemKey}
            renderItem={renderSkeletonRow}
        />
    </IonContent>
);

export default ShoppingListSkeleton;
