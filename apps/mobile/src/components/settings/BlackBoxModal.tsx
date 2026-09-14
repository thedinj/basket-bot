import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import DebugLogView from "./DebugLogView";

interface BlackBoxModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * The flight recorder: recent client-side errors on this device, recovered after the crash.
 *
 * Lifted out of the About modal, where the raw list used to render inline and push the footer
 * off the bottom of the screen once a few errors had accumulated. `DebugLogView` is unchanged -
 * it already returns a bare fragment of rows meant to sit inside someone else's list.
 */
const BlackBoxModal: React.FC<BlackBoxModalProps> = ({ isOpen, onClose }) => (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
            <IonToolbar>
                <IonTitle>Black Box</IonTitle>
                <IonButtons slot="end">
                    <IonButton onClick={onClose}>
                        <IonIcon slot="icon-only" icon={closeOutline} />
                    </IonButton>
                </IonButtons>
            </IonToolbar>
        </IonHeader>
        <IonContent>
            <IonList>
                <DebugLogView />
            </IonList>
        </IonContent>
    </IonModal>
);

export default BlackBoxModal;
