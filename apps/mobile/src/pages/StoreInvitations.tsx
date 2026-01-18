import type { StoreInvitationDetail } from "@basket-bot/core";
import {
    IonAlert,
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonText,
    RefresherEventDetail,
} from "@ionic/react";
import { checkmarkCircleOutline, closeCircleOutline } from "ionicons/icons";
import { useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import {
    useAcceptStoreInvitation,
    useDeclineStoreInvitation,
    useStoreInvitations,
} from "../db/hooks";

const StoreInvitations: React.FC = () => {
    const { data: invitations, isLoading, refetch } = useStoreInvitations();
    const acceptInvitation = useAcceptStoreInvitation();
    const declineInvitation = useDeclineStoreInvitation();

    const [acceptConfirm, setAcceptConfirm] = useState<StoreInvitationDetail | null>(null);
    const [declineConfirm, setDeclineConfirm] = useState<StoreInvitationDetail | null>(null);

    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        await refetch();
        event.detail.complete();
    };

    const handleAccept = async (invitation: StoreInvitationDetail) => {
        await acceptInvitation.mutateAsync(invitation.token);
        setAcceptConfirm(null);
    };

    const handleDecline = async (invitation: StoreInvitationDetail) => {
        await declineInvitation.mutateAsync(invitation.token);
        setDeclineConfirm(null);
    };

    return (
        <IonPage>
            <AppHeader title="Store Invitations" showBackButton backButtonHref="/stores" />
            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>

                {isLoading ? (
                    <IonList>
                        {[1, 2, 3].map((i) => (
                            <IonItem key={i}>
                                <IonLabel>
                                    <IonSkeletonText animated style={{ width: "70%" }} />
                                    <IonSkeletonText animated style={{ width: "50%" }} />
                                </IonLabel>
                            </IonItem>
                        ))}
                    </IonList>
                ) : invitations && invitations.length > 0 ? (
                    <IonList>
                        {invitations.map((invitation) => (
                            <IonItem key={invitation.id}>
                                <IonLabel className="ion-text-wrap">
                                    <h2>
                                        <strong>{invitation.storeName}</strong>
                                    </h2>
                                    <p>
                                        {invitation.inviterName} ({invitation.inviterEmail}) invited
                                        you as <strong>{invitation.role}</strong>
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--ion-color-medium)",
                                        }}
                                    >
                                        {new Date(invitation.createdAt).toLocaleDateString()}
                                    </p>
                                </IonLabel>
                                <div
                                    slot="end"
                                    style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                                >
                                    <IonButton
                                        size="small"
                                        color="success"
                                        onClick={() => setAcceptConfirm(invitation)}
                                    >
                                        <IonIcon slot="start" icon={checkmarkCircleOutline} />
                                        Accept
                                    </IonButton>
                                    <IonButton
                                        size="small"
                                        color="danger"
                                        fill="outline"
                                        onClick={() => setDeclineConfirm(invitation)}
                                    >
                                        <IonIcon slot="start" icon={closeCircleOutline} />
                                        Decline
                                    </IonButton>
                                </div>
                            </IonItem>
                        ))}
                    </IonList>
                ) : (
                    <div className="ion-padding ion-text-center">
                        <IonText color="medium">
                            <h3>No pending invitations</h3>
                            <p>You don't have any store invitations at the moment.</p>
                        </IonText>
                    </div>
                )}

                <IonAlert
                    isOpen={!!acceptConfirm}
                    onDidDismiss={() => setAcceptConfirm(null)}
                    header="Accept Invitation"
                    message={`Join "${acceptConfirm?.storeName}" as ${acceptConfirm?.role}?`}
                    buttons={[
                        {
                            text: "Cancel",
                            role: "cancel",
                        },
                        {
                            text: "Accept",
                            handler: () => {
                                if (acceptConfirm) {
                                    handleAccept(acceptConfirm);
                                }
                            },
                        },
                    ]}
                />

                <IonAlert
                    isOpen={!!declineConfirm}
                    onDidDismiss={() => setDeclineConfirm(null)}
                    header="Decline Invitation"
                    message={`Decline invitation to "${declineConfirm?.storeName}"?`}
                    buttons={[
                        {
                            text: "Cancel",
                            role: "cancel",
                        },
                        {
                            text: "Decline",
                            role: "destructive",
                            handler: () => {
                                if (declineConfirm) {
                                    handleDecline(declineConfirm);
                                }
                            },
                        },
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default StoreInvitations;
