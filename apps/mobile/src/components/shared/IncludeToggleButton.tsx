import { IonButton, IonIcon } from "@ionic/react";
import { cart, cartOutline } from "ionicons/icons";

interface IncludeToggleButtonProps {
    /** True when the item will be added to the shopping list. */
    included: boolean;
    onClick: () => void;
    /** Item name, used to build the aria-label. */
    label: string;
}

/**
 * Same fill="clear" size="small" icon-button shape used by every other icon button in
 * these rows (e.g. the delete button) — see UnsureToggleButton, its usual neighbor.
 */
const IncludeToggleButton: React.FC<IncludeToggleButtonProps> = ({ included, onClick, label }) => (
    <IonButton
        fill="clear"
        size="small"
        color={included ? "primary" : "medium"}
        onClick={onClick}
        aria-label={included ? `Skip ${label}` : `Add ${label} to shopping list`}
    >
        <IonIcon slot="icon-only" icon={included ? cart : cartOutline} />
    </IonButton>
);

export default IncludeToggleButton;
