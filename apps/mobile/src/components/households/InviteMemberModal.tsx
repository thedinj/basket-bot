import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useState } from "react";
import { useInviteMember } from "../../db/hooks";

interface InviteMemberModalProps {
    householdId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ householdId, isOpen, onClose }) => {
    const [email, setEmail] = useState("");
    const inviteMember = useInviteMember();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!householdId || !email.trim()) return;

        await inviteMember.mutateAsync({ householdId, email: email.trim() });
        setEmail("");
        onClose();
    };

    const handleClose = () => {
        setEmail("");
        onClose();
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Invite Member</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit}>
                    <IonList>
                        <IonItem>
                            <IonLabel position="stacked">Email</IonLabel>
                            <IonInput
                                type="email"
                                value={email}
                                onIonInput={(e) => setEmail(e.detail.value || "")}
                                placeholder="member@example.com"
                                required
                                disabled={inviteMember.isPending}
                            />
                        </IonItem>
                    </IonList>

                    <div className="ion-padding">
                        <IonButton
                            expand="block"
                            type="submit"
                            disabled={!householdId || !email.trim() || inviteMember.isPending}
                        >
                            {inviteMember.isPending ? "Sending..." : "Send Invitation"}
                        </IonButton>
                    </div>
                </form>
            </IonContent>
        </IonModal>
    );
};

export default InviteMemberModal;
