import type { StoreAisle } from "@basket-bot/core";
import { IonButton, IonIcon, IonItem, IonLabel, IonReorder } from "@ionic/react";
import { create } from "ionicons/icons";
import { AislePlate } from "../shared/AislePlate";
import { aislePlate } from "../shared/grouping.utils";
import { useStoreManagement } from "./StoreManagementContext";

interface AisleItemProps {
    aisle: StoreAisle;
    showReorderHandle?: boolean;
}

export const AisleItem = ({ aisle, showReorderHandle = true }: AisleItemProps) => {
    const { openEditAisleModal } = useStoreManagement();
    // Exactly what the shopping list shows for this aisle: the same plate and the same label
    // beside it ("[AISLE 3]" alone, "[7] Baking", "[🥬] Produce"), so edits preview here as-is.
    const plate = aislePlate({ aisleId: aisle.id, aisleName: aisle.name, aisleEmoji: aisle.emoji });

    return (
        <div>
            <IonItem className="aisle-item" lines="none">
                <AislePlate slot="start" badge={plate.badge} kind={plate.badgeKind} />
                <IonLabel>
                    {plate.label && <h2 style={{ fontWeight: "bold" }}>{plate.label}</h2>}
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
