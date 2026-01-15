import type { StoreAisle, StoreSection } from "@basket-bot/core";
import { ItemReorderEventDetail } from "@ionic/core";
import { IonButton, IonIcon, IonItem, IonLabel, IonReorder, IonReorderGroup } from "@ionic/react";
import { create } from "ionicons/icons";
import { SectionItem } from "./SectionItem";
import { useStoreManagement } from "./StoreManagementContext";

interface AisleItemProps {
    aisle: StoreAisle;
    sections: Array<StoreSection>;
    onSectionReorder: (event: CustomEvent<ItemReorderEventDetail>, aisleId: string) => void;
    showReorderHandle?: boolean;
    showSectionReorderHandles?: boolean;
}

export const AisleItem = ({
    aisle,
    sections,
    onSectionReorder,
    showReorderHandle = true,
    showSectionReorderHandles = true,
}: AisleItemProps) => {
    const { openEditAisleModal } = useStoreManagement();

    const aisleSections = sections.filter((s) => s.aisleId === aisle.id);

    return (
        <div>
            <IonItem className="aisle-item" lines="none">
                <IonLabel>
                    <h2 style={{ fontWeight: "bold" }}>{aisle.name}</h2>
                </IonLabel>
                <IonButton
                    slot="end"
                    fill="clear"
                    onClick={() => openEditAisleModal(aisle)}
                    aria-label={`Edit aisle ${aisle.name}`}
                    style={{ marginRight: 0 }}
                >
                    <IonIcon icon={create} />
                </IonButton>
                {showReorderHandle ? (
                    <IonReorder slot="end" />
                ) : (
                    <div
                        slot="end"
                        style={{
                            width: 32,
                            minWidth: 32,
                            height: 24,
                            display: "inline-block",
                        }}
                    />
                )}
            </IonItem>

            {aisleSections.length > 0 && (
                <IonReorderGroup
                    disabled={!showSectionReorderHandles}
                    onIonItemReorder={(e) => onSectionReorder(e, aisle.id)}
                >
                    {aisleSections.map((section) => (
                        <SectionItem
                            key={section.id}
                            section={section}
                            showReorderHandle={showSectionReorderHandles}
                        />
                    ))}
                </IonReorderGroup>
            )}
        </div>
    );
};
