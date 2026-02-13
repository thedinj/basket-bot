import { IonIcon, IonItemDivider, IonLabel, IonList } from "@ionic/react";
import { Fragment, ReactNode, useMemo } from "react";
import { ItemGroup } from "./grouping.types";

interface RenderedGroupProps<T> {
    group: ItemGroup<T>;
    renderItem: (item: T, groupId: string) => ReactNode;
}

const RenderedGroup = <T,>({ group, renderItem }: RenderedGroupProps<T>) => {
    const sortedChildren = useMemo(
        () => (group.children ? [...group.children].sort((a, b) => a.sortOrder - b.sortOrder) : []),
        [group.children]
    );

    const hasContent = group.items.length > 0 || (group.children && group.children.length > 0);
    if (!hasContent) return null;

    return (
        <Fragment key={group.id}>
            {!!group.header && (
                <IonItemDivider
                    sticky={group.header.sticky}
                    color={group.header.color}
                    style={group.header.style}
                >
                    {group.header.icon && <IonIcon icon={group.header.icon} slot="start" />}
                    <IonLabel style={group.header.labelStyle}>{group.header.label}</IonLabel>
                    {group.header.actionSlot && <div slot="end">{group.header.actionSlot}</div>}
                </IonItemDivider>
            )}
            <div style={{ paddingLeft: group.indentLevel || 0 }}>
                {group.items.map((item) => renderItem(item, group.id))}
                {sortedChildren.map((child) => (
                    <RenderedGroup key={child.id} group={child} renderItem={renderItem} />
                ))}
            </div>
        </Fragment>
    );
};

interface GroupedItemListProps<T> {
    groups: ItemGroup<T>[];
    renderItem: (item: T, groupId: string) => ReactNode;
    emptyMessage?: string;
}

/**
 * Generic list component that displays items organized into groups with headers.
 * Supports nested groups (e.g., sections within aisles) and fully customizable headers.
 */
export function GroupedItemList<T>({
    groups,
    renderItem,
    emptyMessage = "No items",
}: GroupedItemListProps<T>) {
    // Sort groups by sortOrder
    const sortedGroups = useMemo(
        () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
        [groups]
    );

    // Check if we have any items across all groups (including nested)
    const hasItems = useMemo(() => {
        const checkGroup = (group: ItemGroup<T>): boolean => {
            if (group.items.length > 0) return true;
            if (group.children && group.children.length > 0) {
                return group.children.some((child) => checkGroup(child));
            }
            return false;
        };
        return sortedGroups.some((group) => checkGroup(group));
    }, [sortedGroups]);

    if (!hasItems) {
        return (
            <IonList>
                <IonItemDivider>
                    <IonLabel>{emptyMessage}</IonLabel>
                </IonItemDivider>
            </IonList>
        );
    }

    return (
        <IonList>
            {sortedGroups.map((group) => (
                <RenderedGroup key={group.id} group={group} renderItem={renderItem} />
            ))}
        </IonList>
    );
}
