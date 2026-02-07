import type { Household, InvitationDetail } from "@basket-bot/core";
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
    IonNote,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { addOutline, checkmarkOutline, closeOutline, peopleOutline } from "ionicons/icons";
import React, { useState } from "react";
import {
    useAcceptInvitation,
    useDeclineInvitation,
    useHouseholds,
    usePendingInvitations,
} from "../../db/hooks";
import { useAppHeader } from "../layout/useAppHeader";
import CreateHouseholdModal from "./CreateHouseholdModal";
import HouseholdDetailModal from "./HouseholdDetailModal";

export const HouseholdManagementModal: React.FC = () => {
    const { isHouseholdsOpen, closeHouseholds } = useAppHeader();
    const {
        data: households,
        isLoading: householdsLoading,
        error: householdsError,
    } = useHouseholds();
    const {
        data: invitations,
        isLoading: invitationsLoading,
        error: invitationsError,
    } = usePendingInvitations();
    const acceptInvitation = useAcceptInvitation();
    const declineInvitation = useDeclineInvitation();

    const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleHouseholdClick = (householdId: string) => {
        setSelectedHouseholdId(householdId);
    };

    const handleAcceptInvitation = async (token: string) => {
        await acceptInvitation.mutateAsync(token);
    };

    const handleDeclineInvitation = async (token: string) => {
        await declineInvitation.mutateAsync(token);
    };

    return (
        <>
            <IonModal isOpen={isHouseholdsOpen} onDidDismiss={closeHouseholds}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Households</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={closeHouseholds}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    {/* Pending Invitations Section */}
                    {invitationsLoading ? (
                        <div className="ion-text-center ion-padding">
                            <IonSpinner />
                        </div>
                    ) : null}

                    {invitationsError ? (
                        <IonText color="danger">
                            <p className="ion-padding">Failed to load invitations</p>
                        </IonText>
                    ) : null}

                    {!invitationsLoading &&
                        !invitationsError &&
                        invitations &&
                        invitations.length > 0 && (
                            <IonList>
                                <IonListHeader>
                                    <h2>Pending Invitations</h2>
                                </IonListHeader>
                                {invitations.map((invitation: InvitationDetail) => (
                                    <div key={invitation.token}>
                                        <IonItem lines="none">
                                            <IonLabel>
                                                <h3>{invitation.householdName}</h3>
                                                <p>Invited by {invitation.inviterName}</p>
                                            </IonLabel>
                                        </IonItem>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "8px",
                                                padding: "0 16px 16px 16px",
                                            }}
                                        >
                                            <IonButton
                                                expand="block"
                                                color="success"
                                                onClick={() =>
                                                    handleAcceptInvitation(invitation.token)
                                                }
                                                disabled={acceptInvitation.isPending}
                                                style={{ flex: 1 }}
                                            >
                                                <IonIcon icon={checkmarkOutline} slot="start" />
                                                Accept
                                            </IonButton>
                                            <IonButton
                                                expand="block"
                                                fill="outline"
                                                color="danger"
                                                onClick={() =>
                                                    handleDeclineInvitation(invitation.token)
                                                }
                                                disabled={declineInvitation.isPending}
                                                style={{ flex: 1 }}
                                            >
                                                <IonIcon icon={closeOutline} slot="start" />
                                                Decline
                                            </IonButton>
                                        </div>
                                    </div>
                                ))}
                            </IonList>
                        )}

                    {/* Households List Section */}
                    <IonList>
                        <IonListHeader>
                            <h2>My Households</h2>
                        </IonListHeader>

                        {householdsLoading ? (
                            <div className="ion-text-center ion-padding">
                                <IonSpinner />
                            </div>
                        ) : null}

                        {householdsError ? (
                            <IonText color="danger">
                                <p className="ion-padding">Failed to load households</p>
                            </IonText>
                        ) : null}

                        {!householdsLoading &&
                            !householdsError &&
                            (!households || households.length === 0) && (
                                <IonItem>
                                    <IonLabel>
                                        <IonNote>
                                            No households yet. Create one to get started!
                                        </IonNote>
                                    </IonLabel>
                                </IonItem>
                            )}

                        {!householdsLoading &&
                            !householdsError &&
                            households &&
                            households.length > 0 &&
                            households.map((household: Household) => (
                                <IonItem
                                    key={household.id}
                                    button
                                    onClick={() => handleHouseholdClick(household.id)}
                                >
                                    <IonIcon icon={peopleOutline} slot="start" />
                                    <IonLabel>
                                        <h3>{household.name}</h3>
                                    </IonLabel>
                                </IonItem>
                            ))}

                        {/* Create Household Button */}
                        <div className="ion-padding">
                            <IonButton expand="block" onClick={() => setIsCreateModalOpen(true)}>
                                <IonIcon icon={addOutline} slot="start" />
                                Create Household
                            </IonButton>
                        </div>
                    </IonList>
                </IonContent>
            </IonModal>

            <CreateHouseholdModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            <HouseholdDetailModal
                householdId={selectedHouseholdId}
                isOpen={!!selectedHouseholdId}
                onClose={() => setSelectedHouseholdId(null)}
            />
        </>
    );
};

export default HouseholdManagementModal;
