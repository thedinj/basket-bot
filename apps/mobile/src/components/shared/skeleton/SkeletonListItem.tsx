import { IonItem, IonLabel, IonSkeletonText } from "@ionic/react"
import type { ReactNode } from "react"

interface SkeletonListItemProps {
    lines?: "none" | "full" | "inset"
    indent?: number
    startSlot?: ReactNode
    widths?: string[]
    endSlot?: ReactNode
}

/**
 * Shared placeholder row for list skeletons — the one place row-shape tweaks (spacing,
 * shimmer widths) live, instead of every list hand-copying its own IonSkeletonText markup.
 */
export const SkeletonListItem: React.FC<SkeletonListItemProps> = ({
    lines,
    indent,
    startSlot,
    widths = ["60%"],
    endSlot,
}) => (
    <IonItem lines={lines}>
        {startSlot && <div slot="start">{startSlot}</div>}
        <IonLabel style={indent ? { paddingLeft: indent } : undefined}>
            {widths.map((width, index) => (
                <IonSkeletonText key={index} animated style={{ width }} />
            ))}
        </IonLabel>
        {endSlot && <div slot="end">{endSlot}</div>}
    </IonItem>
)
