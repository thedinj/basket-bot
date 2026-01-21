import type { StoreAisle } from "@basket-bot/core";
import { IonButton, IonIcon, IonItem, IonLabel, IonReorder } from "@ionic/react";
import { create } from "ionicons/icons";
import { useStoreManagement } from "./StoreManagementContext";

interface AisleItemProps {
    aisle: StoreAisle;
    showReorderHandle?: boolean;
}

export const AisleItem = ({ aisle, showReorderHandle = true }: AisleItemProps) => {
    const { openEditAisleModal } = useStoreManagement();

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
        </div>
    );
};
