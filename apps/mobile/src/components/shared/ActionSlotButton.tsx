import { IonButton, IonIcon } from "@ionic/react";
import React from "react";

interface ActionSlotButtonProps {
    /**
     * Button label text
     */
    label: string;

    /**
     * Click handler
     */
    onClick: () => void;

    /**
     * Optional Ionicon name to show before label
     */
    icon?: string;

    /**
     * Optional custom SVG icon path to show before label (overrides icon)
     */
    iconSrc?: string;

    /**
     * Whether the button is disabled
     */
    disabled?: boolean;

    /**
     * Optional test ID for testing
     */
    testId?: string;
}

/**
 * Standardized button component for use in group header actionSlots.
 * Provides consistent styling and layout for action buttons in ItemGroup headers.
 */
const ActionSlotButton: React.FC<ActionSlotButtonProps> = ({
    label,
    onClick,
    icon,
    iconSrc,
    disabled = false,
    testId,
}) => {
    return (
        <IonButton
            fill="clear"
            size="small"
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
        >
            {iconSrc ? (
                <IonIcon slot="start" src={iconSrc} />
            ) : (
                icon && <IonIcon slot="start" icon={icon} />
            )}
            {label}
        </IonButton>
    );
};

export default ActionSlotButton;
