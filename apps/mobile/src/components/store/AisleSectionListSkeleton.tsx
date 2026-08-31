import { IonLabel, IonList, IonSegment, IonSegmentButton } from "@ionic/react";
import { Fragment } from "react";
import { SkeletonListItem } from "../shared/skeleton/SkeletonListItem";

// Matches the 32x24 reorder-handle/edit-button spacer in AisleItem.tsx / SectionItem.tsx.
const END_SLOT_SPACER = (
    <div style={{ width: 32, minWidth: 32, height: 24, display: "inline-block" }} />
);

const SKELETON_AISLES = [{ sectionCount: 2 }, { sectionCount: 1 }, { sectionCount: 3 }];

/**
 * Content-shaped fallback for AisleSectionList — mirrors AisleItem/SectionItem's exact row
 * structure (lines="none", 16px section indent, end-slot spacer) plus the segment toggle,
 * so nothing shifts or pops in once the real aisles/sections load.
 */
export const AisleSectionListSkeleton: React.FC = () => (
    <>
        <div style={{ padding: "16px", paddingBottom: "8px" }}>
            <IonSegment value="sections" disabled>
                <IonSegmentButton value="sections">
                    <IonLabel>Reorder Sections</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="aisles">
                    <IonLabel>Reorder Aisles</IonLabel>
                </IonSegmentButton>
            </IonSegment>
        </div>

        <IonList>
            {SKELETON_AISLES.map((aisle, aisleIndex) => (
                <Fragment key={aisleIndex}>
                    <SkeletonListItem lines="none" widths={["50%"]} endSlot={END_SLOT_SPACER} />
                    {Array.from({ length: aisle.sectionCount }, (_, sectionIndex) => (
                        <SkeletonListItem
                            key={sectionIndex}
                            lines="none"
                            indent={16}
                            widths={["40%"]}
                            endSlot={END_SLOT_SPACER}
                        />
                    ))}
                </Fragment>
            ))}
        </IonList>
    </>
);

export default AisleSectionListSkeleton;
