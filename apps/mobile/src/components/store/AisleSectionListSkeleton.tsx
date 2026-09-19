import { IonLabel, IonSegment, IonSegmentButton, IonSkeletonText } from "@ionic/react";
import { CSSProperties, Fragment } from "react";
import "./AisleSectionList.scss";

const SKELETON_AISLES = [
    { width: "50%", sections: ["40%", "55%"] },
    { width: "35%", sections: ["45%"] },
    { width: "60%", sections: ["30%", "50%", "40%"] },
];

const widthStyle = (width: string) => ({ "--skeleton-width": width }) as CSSProperties;

/**
 * Content-shaped fallback for AisleSectionList: the mode switch, then aisle bars and section
 * rows on the same grid as AisleItem / SectionItem (plate column, 62px name column, the pencil
 * and reorder columns), so nothing shifts once the real aisles and sections load.
 */
export const AisleSectionListSkeleton: React.FC = () => (
    <>
        <div className="aisle-section-list__modes">
            <IonSegment value="sections" disabled>
                <IonSegmentButton value="sections">
                    <IonLabel>Reorder Sections</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="aisles">
                    <IonLabel>Reorder Aisles</IonLabel>
                </IonSegmentButton>
            </IonSegment>
        </div>

        <div aria-hidden="true">
            {SKELETON_AISLES.map((aisle, aisleIndex) => (
                <Fragment key={aisleIndex}>
                    <div className="aisle-row aisle-row--aisle aisle-row--skeleton">
                        <div className="aisle-row__main">
                            <IonSkeletonText animated className="aisle-row__skeleton-plate" />
                            <IonSkeletonText
                                animated
                                className="aisle-row__skeleton-text"
                                style={widthStyle(aisle.width)}
                            />
                        </div>
                        <span className="aisle-row__handle" />
                    </div>
                    {aisle.sections.map((width, sectionIndex) => (
                        <div
                            key={sectionIndex}
                            className="aisle-row aisle-row--section aisle-row--skeleton"
                        >
                            <div className="aisle-row__main">
                                <IonSkeletonText
                                    animated
                                    className="aisle-row__skeleton-text"
                                    style={widthStyle(width)}
                                />
                            </div>
                            <span className="aisle-row__handle" />
                        </div>
                    ))}
                </Fragment>
            ))}
        </div>
    </>
);

export default AisleSectionListSkeleton;
