import { ItemReorderEventDetail } from "@ionic/core";
import {
    IonLabel,
    IonList,
    IonReorderGroup,
    IonSegment,
    IonSegmentButton,
} from "@ionic/react";
import React from "react";
import {
    useMoveSection,
    useReorderAisles,
    useReorderSections,
    useStoreAisles,
    useStoreSections,
} from "../../db/hooks";
import type { StoreAisle, StoreSection } from "../../db/types";
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
    const { data: sections, isLoading: sectionsLoading } =
        useStoreSections(storeId);
    const reorderAisles = useReorderAisles();
    const reorderSections = useReorderSections();
    const moveSection = useMoveSection();

    const handleAisleReorder = async (
        event: CustomEvent<ItemReorderEventDetail>
    ) => {
        if (!aisles) return;

        const from = event.detail.from;
        const to = event.detail.to;

        const reordered = [...aisles];
        const [movedItem] = reordered.splice(from, 1);
        reordered.splice(to, 0, movedItem);

        const updates = reordered.map((aisle, index) => ({
            id: aisle.id,
            sort_order: index,
        }));

        await reorderAisles.mutateAsync({ updates, storeId });

        event.detail.complete();
    };

    const handleSectionReorder = async (
        event: CustomEvent<ItemReorderEventDetail>,
        aisleId: string
    ) => {
        event.stopPropagation();

        if (!sections) return;

        const aisleSections = sections.filter((s) => s.aisle_id === aisleId);
        const from = event.detail.from;
        const to = event.detail.to;

        const reordered = [...aisleSections];
        const [movedItem] = reordered.splice(from, 1);
        reordered.splice(to, 0, movedItem);

        const updates = reordered.map((section, index) => ({
            id: section.id,
            sort_order: index,
        }));

        await reorderSections.mutateAsync({ updates, storeId });

        event.detail.complete();
    };

    const handleFlatSectionReorder = async (
        event: CustomEvent<ItemReorderEventDetail>
    ) => {
        if (!sections || !aisles) return;

        const from = event.detail.from;
        const to = event.detail.to;

        // Build flat list matching the DOM structure (aisle header, then sections)
        const flatList: Array<{
            type: "aisle" | "section";
            item: StoreAisle | StoreSection;
        }> = [];
        aisles.forEach((aisle: StoreAisle) => {
            flatList.push({ type: "aisle", item: aisle });
            const aisleSections = sections.filter(
                (s: StoreSection) => s.aisle_id === aisle.id
            );
            aisleSections.forEach((section: StoreSection) => {
                flatList.push({ type: "section", item: section });
            });
        });

        // Get section-only list for index mapping
        const sectionOnlyList = flatList.filter(
            (item) => item.type === "section"
        ) as Array<{ type: "section"; item: StoreSection }>;

        if (from >= sectionOnlyList.length || to >= sectionOnlyList.length) {
            event.detail.complete();
            return;
        }

        const movedSection: StoreSection = sectionOnlyList[from].item;
        const sourceAisleId = movedSection.aisle_id;

        // Find destination aisle by looking at flat list position
        // Map "to" index (in section-only list) back to flat list
        let sectionCount = 0;
        let destAisleId = aisles[0].id; // Default to first aisle

        for (let i = 0; i < flatList.length; i++) {
            if (flatList[i].type === "aisle") {
                destAisleId = (flatList[i].item as StoreAisle).id;
            } else if (flatList[i].type === "section") {
                if (sectionCount === to) {
                    break;
                }
                sectionCount++;
            }
        }

        // Same aisle - simple reorder
        if (sourceAisleId === destAisleId) {
            const aisleSections = sections.filter(
                (s: StoreSection) => s.aisle_id === sourceAisleId
            );
            const reordered = [...aisleSections];
            const sourceIndex = reordered.findIndex(
                (s) => s.id === movedSection.id
            );
            const [moved] = reordered.splice(sourceIndex, 1);

            // Calculate destination index within this aisle
            const destIndex = to > from ? to - 1 : to;
            const destIndexInAisle = Math.min(destIndex, reordered.length);
            reordered.splice(destIndexInAisle, 0, moved);

            const updates = reordered.map((section, index) => ({
                id: section.id,
                sort_order: index,
            }));

            await reorderSections.mutateAsync({ updates, storeId });
        } else {
            // Cross-aisle move
            const sourceSections = sections
                .filter(
                    (s: StoreSection) =>
                        s.aisle_id === sourceAisleId && s.id !== movedSection.id
                )
                .map((s: StoreSection, index: number) => ({
                    id: s.id,
                    sort_order: index,
                }));

            const destSections = sections.filter(
                (s: StoreSection) => s.aisle_id === destAisleId
            );

            // Calculate position within destination aisle
            const destAisleSectionList = sectionOnlyList.filter(
                (item) => item.item.aisle_id === destAisleId
            );
            const destSectionIndexInAisle = destAisleSectionList.findIndex(
                (item) => sectionOnlyList.indexOf(item) >= to
            );
            const newSortOrder =
                destSectionIndexInAisle === -1
                    ? destSections.length
                    : destSectionIndexInAisle;

            // Make room in destination
            const updatedDestSections = destSections.map(
                (s: StoreSection, index: number) => ({
                    id: s.id,
                    sort_order: index >= newSortOrder ? index + 1 : index,
                })
            );

            await moveSection.mutateAsync({
                sectionId: movedSection.id,
                newAisleId: destAisleId,
                newSortOrder,
                sourceSections,
                destSections: updatedDestSections,
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

    if (
        !aisles ||
        !sections ||
        (aisles.length === 0 && sections.length === 0)
    ) {
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
                    <IonReorderGroup
                        disabled={false}
                        onIonItemReorder={handleAisleReorder}
                    >
                        {aisles.map((aisle) => (
                            <AisleItem
                                key={aisle.id}
                                aisle={aisle}
                                sections={
                                    [] /* sections omitted intentionally */
                                }
                                onSectionReorder={handleSectionReorder}
                                showReorderHandle={true}
                                showSectionReorderHandles={false}
                            />
                        ))}
                    </IonReorderGroup>
                ) : (
                    <IonReorderGroup
                        disabled={false}
                        onIonItemReorder={handleFlatSectionReorder}
                    >
                        {aisles.map((aisle) => {
                            const aisleSections = sections.filter(
                                (s) => s.aisle_id === aisle.id
                            );
                            return (
                                <React.Fragment key={aisle.id}>
                                    <AisleItem
                                        aisle={aisle}
                                        sections={[]}
                                        onSectionReorder={handleSectionReorder}
                                        showReorderHandle={false}
                                        showSectionReorderHandles={false}
                                    />
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
