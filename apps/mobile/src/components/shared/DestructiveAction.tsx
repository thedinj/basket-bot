import { IonButton, IonSpinner } from "@ionic/react";
import { ReactNode } from "react";

type DestructiveActionProps = {
    /** Names the act and its object: "Delete recipe", "Leave household". */
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    busy?: boolean;
};

/**
 * The one way to delete (or leave) the thing a sheet is about: a full-width 48px outlined
 * danger button at the foot of the sheet's content, set 32px apart from the form above it.
 * Never in the header, where it sits beside Close; never in the footer, where it sits beside
 * Save. Outlined, so it doesn't outshout the primary action. The caller confirms before acting.
 * Stack several (Delete household, Leave household) and they share one zone.
 * Styles: theme/forms.scss (.destructive-action).
 */
export const DestructiveAction: React.FC<DestructiveActionProps> = ({
    children,
    onClick,
    disabled,
    busy,
}) => (
    <IonButton
        className="destructive-action"
        expand="block"
        fill="outline"
        color="danger"
        onClick={onClick}
        disabled={disabled || busy}
    >
        {busy ? <IonSpinner name="dots" /> : children}
    </IonButton>
);
