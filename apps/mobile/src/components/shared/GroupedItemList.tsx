import { IonIcon, IonItemDivider, IonLabel, IonList } from "@ionic/react";
import { ReactNode, useCallback, useMemo } from "react";
import { AislePlate } from "./AislePlate";
import { AnimatedGroup } from "./AnimatedGroup";
import "./GroupedItemList.scss";
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
            <IonItemDivider color={header.color} style={header.style}>
                {header.icon && <IonIcon icon={header.icon} slot="start" />}
                {header.badge !== undefined && (
                    <AislePlate
                        slot="start"
                        badge={header.badge}
                        kind={header.badgeKind}
                        color={header.badgeColor}
                    />
                )}
                <IonLabel style={header.labelStyle} className={header.labelClassName}>
                    {/* A number-only aisle's sign plate carries the whole name ("AISLE 3"). */}
                    {!!header.label && <span className="group-header-title">{header.label}</span>}
                </IonLabel>
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
        // The group wrapper is the sticky header's containing block, so a header stays pinned
        // only while its own group is on screen and is pushed off by the next one. (Stickiness
        // lives on AnimatedGroup's motion wrapper: IonItemDivider's own `sticky` would be
        // confined to that wrapper, which is exactly the header's height, and never move.)
        // Headers differ in height (a two-line aisle name, a section row), and scoping each to its
        // group keeps a taller one from peeking out beneath the shorter one that replaces it.
        <div className="grouped-list__group">
            {!!group.header && (
                <AnimatedGroup
                    items={[group.header]}
                    getKey={getHeaderKey}
                    renderItem={renderHeader}
                    itemClassName={group.header.sticky ? "grouped-list__sticky-header" : undefined}
                />
            )}
            {/* Rows are not indented under their header: a row's checkbox column sits in the
                same place as the header's plate column, so headers and items share one text
                column (GroupedItemList.scss). */}
            <div className="grouped-list__items">
                <AnimatedGroup
                    items={group.items}
                    getKey={getItemKey}
                    renderItem={renderGroupItem}
                />
                {sortedChildren.map((child) => (
                    <RenderedGroup
                        key={child.id}
                        group={child}
                        renderItem={renderItem}
                        getItemKey={getItemKey}
                    />
                ))}
            </div>
        </div>
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
