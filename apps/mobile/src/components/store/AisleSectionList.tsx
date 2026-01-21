import { ItemReorderEventDetail } from "@ionic/core";
import { IonLabel, IonList, IonReorderGroup, IonSegment, IonSegmentButton } from "@ionic/react";
import React from "react";
import {
    useMoveSection,
    useReorderAisles,
    useReorderSections,
    useStoreAisles,
    useStoreSections,
} from "../../db/hooks";
import type { StoreSection } from "../../db/types";
import { AisleItem } from "./AisleItem";
import { DeleteConfirmationAlert } from "./DeleteConfirmationAlert";
import { EmptyState } from "./EmptyState";
import { EntityFormModal } from "./EntityFormModal";
import { LoadingState } from "./LoadingState";
import { SectionItem } from "./SectionItem";
import { ReorderMode, useStoreManagement } from "./StoreManagementContext";

interface AisleSectionListProps {
    storeId: string;
}

const AisleSectionList: React.FC<AisleSectionListProps> = ({ storeId }) => {
    const { mode, setMode } = useStoreManagement();
    const { data: aisles, isLoading: aislesLoading } = useStoreAisles(storeId);
    const { data: sections, isLoading: sectionsLoading } = useStoreSections(storeId);
    const reorderAisles = useReorderAisles();
    const reorderSections = useReorderSections();
    const moveSection = useMoveSection();

    const handleAisleReorder = async (event: CustomEvent<ItemReorderEventDetail>) => {
        if (!aisles) return;

        const from = event.detail.from;
        const to = event.detail.to;

        const reordered = [...aisles];
        const [movedItem] = reordered.splice(from, 1);
        reordered.splice(to, 0, movedItem);

        const updates = reordered.map((aisle, index) => ({
            id: aisle.id,
            sortOrder: index,
        }));

        await reorderAisles.mutateAsync({ updates, storeId });

        event.detail.complete();
    };

    const handleFlatSectionReorder = async (event: CustomEvent<ItemReorderEventDetail>) => {
        if (!sections || !aisles) return;

        const from = event.detail.from;
        const to = event.detail.to;

        // Build flat list of sections in display order
        const flatSections: StoreSection[] = [];
        aisles.forEach((aisle) => {
            const aisleSections = sections
                .filter((s) => s.aisleId === aisle.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
            flatSections.push(...aisleSections);
        });

        // Map DOM indices (which include aisle headers) to section-only indices
        // For each aisle before the position, subtract 1
        const mapDomIndexToSectionIndex = (domIndex: number): number => {
            let sectionIndex = domIndex;
            let elementsBeforeIndex = 0;

            for (const aisle of aisles) {
                const aisleHeaderPosition = elementsBeforeIndex;
                if (domIndex <= aisleHeaderPosition) break;

                sectionIndex--; // Account for aisle header
                const aisleSectionCount = sections.filter((s) => s.aisleId === aisle.id).length;
                elementsBeforeIndex += 1 + aisleSectionCount; // 1 header + sections
            }

            return sectionIndex;
        };

        const fromSectionIndex = mapDomIndexToSectionIndex(from);
        const toSectionIndex = mapDomIndexToSectionIndex(to);

        if (fromSectionIndex >= flatSections.length || toSectionIndex >= flatSections.length) {
            event.detail.complete();
            return;
        }

        // Reorder the flat list
        const reordered = [...flatSections];
        const [movedSection] = reordered.splice(fromSectionIndex, 1);
        reordered.splice(toSectionIndex, 0, movedSection);

        // Determine destination aisle by finding which aisle this position falls into
        let destAisleId = aisles[0].id;
        let positionInAisle = toSectionIndex;

        for (const aisle of aisles) {
            const aisleSize = sections.filter((s) => s.aisleId === aisle.id).length;
            if (positionInAisle < aisleSize) {
                destAisleId = aisle.id;
                break;
            }
            positionInAisle -= aisleSize;
        }

        const sourceAisleId = movedSection.aisleId;

        // Same aisle - simple reorder
        if (sourceAisleId === destAisleId) {
            const aisleSections = reordered.filter((s) => s.aisleId === destAisleId);
            const updates = aisleSections.map((section, index) => ({
                id: section.id,
                sortOrder: index,
            }));

            await reorderSections.mutateAsync({ updates, storeId });
        } else {
            // Cross-aisle move - update source aisle sections and move section to dest
            const sourceSections = sections
                .filter((s) => s.aisleId === sourceAisleId && s.id !== movedSection.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((s, index) => ({
                    id: s.id,
                    sortOrder: index,
                }));

            const destSections = reordered
                .filter((s) => s.aisleId === destAisleId && s.id !== movedSection.id)
                .map((s, index) => ({
                    id: s.id,
                    sortOrder: index < positionInAisle ? index : index + 1,
                }));

            await moveSection.mutateAsync({
                sectionId: movedSection.id,
                newAisleId: destAisleId,
                newSortOrder: positionInAisle,
                sourceSections,
                destSections,
                storeId,
                sectionName: movedSection.name,
            });
        }

        event.detail.complete();
    };

    const isLoading = aislesLoading || sectionsLoading;

    if (isLoading) {
        return (
            <>
                <LoadingState />
                <EntityFormModal storeId={storeId} aisles={aisles} />
                <DeleteConfirmationAlert storeId={storeId} />
            </>
        );
    }

    if (!aisles || !sections || (aisles.length === 0 && sections.length === 0)) {
        return (
            <>
                <EmptyState />
                <EntityFormModal storeId={storeId} aisles={aisles} />
                <DeleteConfirmationAlert storeId={storeId} />
            </>
        );
    }

    return (
        <>
            <div style={{ padding: "16px", paddingBottom: "8px" }}>
                <IonSegment
                    value={mode}
                    onIonChange={(e) => setMode(e.detail.value as ReorderMode)}
                >
                    <IonSegmentButton value="sections">
                        <IonLabel>Reorder Sections</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="aisles">
                        <IonLabel>Reorder Aisles</IonLabel>
                    </IonSegmentButton>
                </IonSegment>
            </div>

            <IonList>
                {mode === "aisles" ? (
                    <IonReorderGroup disabled={false} onIonReorderEnd={handleAisleReorder}>
                        {aisles.map((aisle) => (
                            <AisleItem key={aisle.id} aisle={aisle} showReorderHandle={true} />
                        ))}
                    </IonReorderGroup>
                ) : (
                    <IonReorderGroup disabled={false} onIonReorderEnd={handleFlatSectionReorder}>
                        {aisles.map((aisle) => {
                            const aisleSections = sections.filter((s) => s.aisleId === aisle.id);
                            return (
                                <React.Fragment key={aisle.id}>
                                    <AisleItem aisle={aisle} showReorderHandle={false} />
                                    {aisleSections.map((section) => (
                                        <SectionItem
                                            key={section.id}
                                            section={section}
                                            showReorderHandle={true}
                                        />
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </IonReorderGroup>
                )}
            </IonList>

            <EntityFormModal storeId={storeId} aisles={aisles} />
            <DeleteConfirmationAlert storeId={storeId} />
        </>
    );
};

export default AisleSectionList;
