import type { StoreSection } from "@basket-bot/core";
import { IonButton, IonIcon, IonItem, IonLabel, IonReorder } from "@ionic/react";
import { create } from "ionicons/icons";
import { useStoreManagement } from "./StoreManagementContext";

interface SectionItemProps {
    section: StoreSection;
    showReorderHandle?: boolean;
}

export const SectionItem = ({ section, showReorderHandle = true }: SectionItemProps) => {
    const { openEditSectionModal } = useStoreManagement();

    return (
        <IonItem className="section-item" lines="none">
            <IonLabel style={{ paddingLeft: 16 }}>
                <p>{section.name}</p>
            </IonLabel>
            <IonButton
                slot="end"
                fill="clear"
                onClick={() => openEditSectionModal(section)}
                aria-label={`Edit section ${section.name}`}
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
    );
};
