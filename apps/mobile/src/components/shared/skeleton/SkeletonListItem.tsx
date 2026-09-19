import { IonItem, IonLabel, IonSkeletonText } from "@ionic/react";
import type { ReactNode } from "react";
import "./SkeletonListItem.scss";

interface SkeletonListItemProps {
    lines?: "none" | "full" | "inset";
    indent?: number;
    /** Drawn in the list's 36px start column (the checkbox / plate column), 10px before the text. */
    startSlot?: ReactNode;
    /** One bar per line: the first is title-height, the rest are the smaller meta/notes lines. */
    widths?: string[];
    endSlot?: ReactNode;
}

/**
 * Shared placeholder row for list skeletons — the one place row-shape tweaks (spacing,
 * shimmer widths) live, instead of every list hand-copying its own IonSkeletonText markup.
 *
 * Its geometry follows a real list row (ShoppingListItem.css): a 36px start column plus a
 * 10px gap, and a label inset 13px / 12px so the first bar centres on the same line as the
 * start column's content. Purely visual; the list that renders it owns the loading
 * announcement.
 */
export const SkeletonListItem: React.FC<SkeletonListItemProps> = ({
    lines,
    indent,
    startSlot,
    widths = ["60%"],
    endSlot,
}) => (
    <IonItem lines={lines} className="skeleton-row">
        {startSlot && (
            <div slot="start" className="skeleton-row__start">
                {startSlot}
            </div>
        )}
        <IonLabel
            className="skeleton-row__label"
            style={indent ? { paddingInlineStart: indent } : undefined}
        >
            {widths.map((width, index) => (
                <IonSkeletonText
                    key={index}
                    animated
                    className={index === 0 ? "skeleton-row__title" : "skeleton-row__meta"}
                    style={{ width }}
                />
            ))}
        </IonLabel>
        {endSlot && <div slot="end">{endSlot}</div>}
    </IonItem>
);
