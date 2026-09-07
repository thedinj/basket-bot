import { IonButton, IonIcon } from "@ionic/react";
import { helpCircle, helpCircleOutline } from "ionicons/icons";
import "./UnsureToggleButton.scss";

interface UnsureToggleButtonProps {
    active: boolean;
    onClick: () => void;
}

/**
 * Always tappable, even when the item isn't currently included — tapping it then adds
 * the item to the cart and marks it unsure in one action (see each caller's onClick).
 */
const UnsureToggleButton: React.FC<UnsureToggleButtonProps> = ({ active, onClick }) => (
    <IonButton
        fill="clear"
        size="small"
        color={active ? "warning" : "medium"}
        onClick={onClick}
        className="unsure-toggle-btn"
        aria-label={active ? "Marked unsure if needed" : "Mark unsure if needed"}
    >
        <IonIcon slot="icon-only" icon={active ? helpCircle : helpCircleOutline} />
    </IonButton>
);

export default UnsureToggleButton;
