import { IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { ReactNode } from "react";

type ModalHeaderProps = {
    title: ReactNode;
    onClose: () => void;
    closeDisabled?: boolean;
    /** Extra icon buttons before Close (an info button). Navigation only: never a delete. */
    actions?: ReactNode;
    /** Something before the title (a mode toggle, a decorative glyph), in the start slot. */
    start?: ReactNode;
    /** Content that belongs to the header and stays put while the sheet scrolls (a step bar, a
     * search field). Rendered inside IonHeader, under the toolbar. */
    children?: ReactNode;
};

/**
 * A sheet's header: its title and a Close button (aria-labelled), plus optional navigation
 * actions and pinned content below the toolbar.
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    onClose,
    closeDisabled,
    actions,
    start,
    children,
}) => (
    <IonHeader>
        <IonToolbar>
            {start && <IonButtons slot="start">{start}</IonButtons>}
            <IonTitle>{title}</IonTitle>
            <IonButtons slot="end">
                {actions}
                <IonButton onClick={onClose} disabled={closeDisabled} aria-label="Close">
                    <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
            </IonButtons>
        </IonToolbar>
        {children}
    </IonHeader>
);
