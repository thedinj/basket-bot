import { ReactNode } from "react";

/**
 * Represents a displayable group of items with optional header and configuration.
 * Groups can have nested children to support hierarchical structures (e.g., sections within aisles).
 */
export interface ItemGroup<T> {
    /**
     * Unique identifier for this group (used as React key)
     */
    id: string;

    /**
     * Items to display in this group
     */
    items: T[];

    /**
     * Optional nested child groups (e.g., sections within an aisle)
     */
    children?: ItemGroup<T>[];

    /**
     * Optional header configuration. If undefined, no header is shown.
     */
    header?: GroupHeader;

    /**
     * Indentation level for items in this group (in pixels or undefined for no indent)
     */
    indentLevel?: number;

    /**
     * Sort order for this group (lower numbers appear first)
     */
    sortOrder: number;
}

/**
 * Configuration for group headers with full control over appearance
 */
export interface GroupHeader {
    /**
     * Header text/label (can be ReactNode for complex headers)
     */
    label: ReactNode;

    /**
     * Optional short code or icon shown in a plate ahead of the label (e.g. an aisle number).
     * An empty string reserves the plate's space without drawing it, so labels in a run of
     * headers line up whether or not each one has a code. Omit it entirely for headers with no
     * plate column.
     */
    badge?: ReactNode;

    /**
     * How a text `badge` is drawn: `code` (an aisle number, the default), `emoji` (a monochrome
     * aisle emoji), or `sign` (a number-only aisle: the plate widens to read "AISLE 3" and the
     * header has no label beside it). Icon badges (ReactNode) ignore this.
     */
    badgeKind?: "code" | "emoji" | "sign";

    /**
     * CSS color for the plate's outline and contents (defaults to the secondary lilac).
     */
    badgeColor?: string;

    /**
     * Optional icon to display
     */
    icon?: string;

    /**
     * Ionic color theme (e.g., "primary", "tertiary", "light")
     */
    color?: string;

    /**
     * Whether header should stick to top when scrolling. It sticks only while its own group
     * is on screen, and the next group's content pushes it off.
     */
    sticky?: boolean;

    /**
     * Custom styling for the header
     */
    style?: React.CSSProperties;

    /**
     * Custom styling for the label
     */
    labelStyle?: React.CSSProperties;

    /**
     * Optional CSS class for the label element
     */
    labelClassName?: string;

    /**
     * Optional action button/element to display in header
     */
    actionSlot?: ReactNode;
}
