import type { StoreAisle } from "@basket-bot/core";
import { IonIcon, IonReorder } from "@ionic/react";
import { createOutline, reorderThree } from "ionicons/icons";
import { AislePlate } from "../shared/AislePlate";
import { aislePlate } from "../shared/grouping.utils";
import { useStoreManagement } from "./StoreManagementContext";

interface AisleItemProps {
    aisle: StoreAisle;
    showReorderHandle?: boolean;
}

export const AisleItem: React.FC<AisleItemProps> = ({ aisle, showReorderHandle = true }) => {
    const { openEditAisleModal } = useStoreManagement();
    // Exactly what the shopping list shows for this aisle: the same plate and the same label
    // beside it ("[AISLE 3]" alone, "[7] Baking", "[🥬] Produce"), so edits preview here as-is.
    const plate = aislePlate({ aisleId: aisle.id, aisleName: aisle.name, aisleEmoji: aisle.emoji });

    return (
        <div className="aisle-row aisle-row--aisle">
            <button
                type="button"
                className="row-button aisle-row__main"
                onClick={() => openEditAisleModal(aisle)}
                aria-label={`Edit aisle ${aisle.name}`}
            >
                <AislePlate badge={plate.badge} kind={plate.badgeKind} />
                <span className="aisle-row__name">{plate.label}</span>
                <IonIcon className="aisle-row__edit" icon={createOutline} aria-hidden="true" />
            </button>
            {showReorderHandle ? (
                <IonReorder className="aisle-row__handle">
                    <IonIcon icon={reorderThree} aria-hidden="true" />
                </IonReorder>
            ) : (
                <span className="aisle-row__handle" aria-hidden="true" />
            )}
        </div>
    );
};
