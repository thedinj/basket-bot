import type { StoreSection } from "@basket-bot/core";
import { IonIcon, IonReorder } from "@ionic/react";
import { createOutline, reorderThree } from "ionicons/icons";
import { useStoreManagement } from "./StoreManagementContext";

interface SectionItemProps {
    section: StoreSection;
    showReorderHandle?: boolean;
}

export const SectionItem: React.FC<SectionItemProps> = ({ section, showReorderHandle = true }) => {
    const { openEditSectionModal } = useStoreManagement();

    return (
        <div className="aisle-row aisle-row--section">
            <button
                type="button"
                className="row-button aisle-row__main"
                onClick={() => openEditSectionModal(section)}
                aria-label={`Edit section ${section.name}`}
            >
                <span className="ruled-label aisle-row__section">
                    <span className="aisle-row__section-name">{section.name}</span>
                </span>
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
