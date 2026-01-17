import type { InvitationDetail } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { checkmarkOutline, closeOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/useToast";
import { useHousehold } from "../../households/useHousehold";
import { invitationApi } from "../../lib/api/household";

interface HouseholdInvitationsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HouseholdInvitationsModal: React.FC<HouseholdInvitationsModalProps> = ({
    isOpen,
    onClose,
}) => {
    const [invitations, setInvitations] = useState<InvitationDetail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { refreshHouseholds } = useHousehold();
    const { showSuccess, showError } = useToast();

    const loadInvitations = async () => {
        setIsLoading(true);
        try {
            const data = await invitationApi.getUserPendingInvitations();
            setInvitations(data);
        } catch (error) {
            console.error("Error loading invitations:", error);
            showError("Failed to load invitations");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadInvitations();
        }
    }, [isOpen]);

    const handleAccept = async (invitation: InvitationDetail) => {
        setProcessingId(invitation.id);
        try {
            await invitationApi.acceptInvitation(invitation.token);
            showSuccess(`Joined ${invitation.householdName}`);
            await refreshHouseholds();
            await loadInvitations();
        } catch (error: any) {
            console.error("Error accepting invitation:", error);
            showError(error.message || "Failed to accept invitation");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDecline = async (invitation: InvitationDetail) => {
        setProcessingId(invitation.id);
        try {
            await invitationApi.declineInvitation(invitation.token);
            showSuccess("Invitation declined");
            await loadInvitations();
        } catch (error: any) {
            console.error("Error declining invitation:", error);
            showError(error.message || "Failed to decline invitation");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>My Invitations</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <IonLabel color="medium">Loading invitations...</IonLabel>
                    </div>
                ) : invitations.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <IonLabel color="medium">
                            <p>No pending invitations</p>
                        </IonLabel>
                    </div>
                ) : (
                    <IonList>
                        <IonListHeader>
                            <h2>Pending Invitations</h2>
                        </IonListHeader>
                        {invitations.map((invitation) => (
                            <IonItem key={invitation.id} lines="full">
                                <IonLabel>
                                    <h2>{invitation.householdName}</h2>
                                    <p>
                                        Invited by {invitation.inviterName} as{" "}
                                        <strong>{invitation.role}</strong>
                                    </p>
                                </IonLabel>
                                <div slot="end" style={{ display: "flex", gap: "8px" }}>
                                    <IonButton
                                        size="small"
                                        color="success"
                                        onClick={() => handleAccept(invitation)}
                                        disabled={processingId !== null}
                                    >
                                        <IonIcon icon={checkmarkOutline} slot="icon-only" />
                                    </IonButton>
                                    <IonButton
                                        size="small"
                                        color="danger"
                                        fill="outline"
                                        onClick={() => handleDecline(invitation)}
                                        disabled={processingId !== null}
                                    >
                                        <IonIcon icon={closeOutline} slot="icon-only" />
                                    </IonButton>
                                </div>
                            </IonItem>
                        ))}
                    </IonList>
                )}
            </IonContent>
        </IonModal>
    );
};
