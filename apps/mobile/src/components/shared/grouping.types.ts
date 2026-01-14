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
     * Optional icon to display
     */
    icon?: string;

    /**
     * Ionic color theme (e.g., "primary", "tertiary", "light")
     */
    color?: string;

    /**
     * Whether header should stick to top when scrolling
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
     * Optional action button/element to display in header
     */
    actionSlot?: ReactNode;
}
