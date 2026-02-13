import { IonIcon, IonItemDivider, IonLabel, IonList } from "@ionic/react";
import { Fragment, ReactNode, useCallback, useMemo } from "react";
import { AnimatedGroup } from "./AnimatedGroup";
import { ItemGroup } from "./grouping.types";

interface RenderedGroupProps<T> {
    group: ItemGroup<T>;
    renderItem: (item: T, groupId: string) => ReactNode;
    getItemKey: (item: T) => string;
}

const RenderedGroup = <T,>({ group, renderItem, getItemKey }: RenderedGroupProps<T>) => {
    const sortedChildren = useMemo(
        () => (group.children ? [...group.children].sort((a, b) => a.sortOrder - b.sortOrder) : []),
        [group.children]
    );

    const renderHeader = useCallback(
        (header: NonNullable<(typeof group)["header"]>) => (
            <IonItemDivider sticky={header.sticky} color={header.color} style={header.style}>
                {header.icon && <IonIcon icon={header.icon} slot="start" />}
                <IonLabel style={header.labelStyle}>{header.label}</IonLabel>
                {header.actionSlot && <div slot="end">{header.actionSlot}</div>}
            </IonItemDivider>
        ),
        []
    );

    const renderGroupItem = useCallback(
        (item: T) => renderItem(item, group.id),
        [renderItem, group.id]
    );

    const getHeaderKey = useCallback(() => `header-${group.id}`, [group.id]);

    const hasContent = group.items.length > 0 || (group.children && group.children.length > 0);
    if (!hasContent) return null;

    return (
        <Fragment key={group.id}>
            {!!group.header && (
                <AnimatedGroup
                    items={[group.header]}
                    getKey={getHeaderKey}
                    renderItem={renderHeader}
                />
            )}
            <div style={{ paddingLeft: group.indentLevel || 0 }}>
                <AnimatedGroup items={group.items} getKey={getItemKey} renderItem={renderGroupItem} />
                {sortedChildren.map((child) => (
                    <RenderedGroup
                        key={child.id}
                        group={child}
                        renderItem={renderItem}
                        getItemKey={getItemKey}
                    />
                ))}
            </div>
        </Fragment>
    );
};

interface GroupedItemListProps<T> {
    groups: ItemGroup<T>[];
    renderItem: (item: T, groupId: string) => ReactNode;
    emptyMessage?: string;
    getItemKey: (item: T) => string;
}

/**
 * Generic list component that displays items organized into groups with headers.
 * Supports nested groups (e.g., sections within aisles) and fully customizable headers.
 */
export function GroupedItemList<T>({
    groups,
    renderItem,
    emptyMessage = "No items",
    getItemKey,
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
                <RenderedGroup
                    key={group.id}
                    group={group}
                    renderItem={renderItem}
                    getItemKey={getItemKey}
                />
            ))}
        </IonList>
    );
}
