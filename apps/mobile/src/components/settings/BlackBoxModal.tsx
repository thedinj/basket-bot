import { IonContent, IonModal } from "@ionic/react";
import { ModalHeader } from "../shared/ModalHeader";
import DebugLogView from "./DebugLogView";

interface BlackBoxModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * The flight recorder: recent client-side errors on this device, recovered after the crash.
 *
 * Lifted out of the About modal, where the raw list used to render inline and push the footer
 * off the bottom of the screen once a few errors had accumulated.
 */
const BlackBoxModal: React.FC<BlackBoxModalProps> = ({ isOpen, onClose }) => (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <ModalHeader title="Black Box" onClose={onClose} />
        <IonContent>
            <DebugLogView />
        </IonContent>
    </IonModal>
);

export default BlackBoxModal;
