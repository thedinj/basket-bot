import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import { householdApi } from "../../lib/api/household";

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    householdId: string;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
    isOpen,
    onClose,
    householdId,
}) => {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { showSuccess, showError } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            showError("Please enter an email address");
            return;
        }

        setIsSubmitting(true);
        try {
            await householdApi.createInvitation(householdId, email.trim());
            showSuccess("Invitation sent successfully");
            setEmail("");
            onClose();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error creating invitation:", error);
            showError(error.message || "Failed to send invitation");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setEmail("");
            onClose();
        }
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Invite Member</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose} disabled={isSubmitting}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit}>
                    <IonItem>
                        <IonLabel position="stacked">Email Address</IonLabel>
                        <IonInput
                            type="email"
                            value={email}
                            onIonInput={(e) => setEmail(e.detail.value || "")}
                            placeholder="friend@example.com"
                            required
                            disabled={isSubmitting}
                        />
                    </IonItem>

                    <div style={{ marginTop: "24px" }}>
                        <IonButton
                            expand="block"
                            type="submit"
                            disabled={isSubmitting || !email.trim()}
                        >
                            {isSubmitting ? "Sending..." : "Send Invitation"}
                        </IonButton>
                    </div>
                </form>
            </IonContent>
        </IonModal>
    );
};
