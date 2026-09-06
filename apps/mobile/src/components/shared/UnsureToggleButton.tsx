import { IonButton, IonIcon } from "@ionic/react";
import { helpCircle, helpCircleOutline } from "ionicons/icons";
import "./UnsureToggleButton.scss";

interface UnsureToggleButtonProps {
    active: boolean;
    /**
     * Disable rather than unmount when "unsure" doesn't apply (e.g. the item is
     * excluded) — keeps this button's slot fixed so nothing after it in the row shifts.
     */
    disabled?: boolean;
    onClick: () => void;
}

const UnsureToggleButton: React.FC<UnsureToggleButtonProps> = ({
    active,
    disabled = false,
    onClick,
}) => (
    <IonButton
        fill="clear"
        size="small"
        color={active ? "warning" : "medium"}
        disabled={disabled}
        onClick={onClick}
        className="unsure-toggle-btn"
        aria-label={active ? "Marked unsure if needed" : "Mark unsure if needed"}
    >
        <IonIcon slot="icon-only" icon={active ? helpCircle : helpCircleOutline} />
    </IonButton>
);

export default UnsureToggleButton;
