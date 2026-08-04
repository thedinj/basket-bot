import { IonSelect, IonSelectOption } from "@ionic/react";
import { useHousehold } from "../../households/useHousehold";

import "./HouseholdSelect.scss";

/**
 * Active-household picker for page headers.
 *
 * Renders nothing when the user belongs to a single household — the selection is
 * unambiguous and the header stays clean. The active id lives in HouseholdProvider
 * (above the tab bar) and is persisted, so switching here is reflected on every page.
 */
export const HouseholdSelect: React.FC = () => {
    const { households, activeHouseholdId, setActiveHouseholdId } = useHousehold();

    if (households.length <= 1) return null;

    return (
        <IonSelect
            value={activeHouseholdId}
            onIonChange={(e) => setActiveHouseholdId(e.detail.value)}
            interface="action-sheet"
            className="household-select"
        >
            {households.map((h) => (
                <IonSelectOption key={h.id} value={h.id}>
                    {h.name}
                </IonSelectOption>
            ))}
        </IonSelect>
    );
};
