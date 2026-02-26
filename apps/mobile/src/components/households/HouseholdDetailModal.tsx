import type { HouseholdInvitation, HouseholdMemberDetail } from "@basket-bot/core";
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
    useIonAlert,
} from "@ionic/react";
import { closeOutline, personAddOutline, trashOutline } from "ionicons/icons";
import React, { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import {
    useCancelInvitation,
    useDeleteHousehold,
    useHouseholdDetail,
    useHouseholdInvitations,
    useRemoveMember,
} from "../../db/hooks";
import EditHouseholdDetailsModal from "./EditHouseholdDetailsModal";
import InviteMemberModal from "./InviteMemberModal";

interface HouseholdDetailModalProps {
    householdId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

const HouseholdDetailModal: React.FC<HouseholdDetailModalProps> = ({
    householdId,
    isOpen,
    onClose,
}) => {
    const { user } = useAuth();
    const { data: household, isLoading, error } = useHouseholdDetail(householdId);
    const { data: invitations, isLoading: invitationsLoading } =
        useHouseholdInvitations(householdId);
    const deleteHousehold = useDeleteHousehold();
    const removeMember = useRemoveMember();
    const cancelInvitation = useCancelInvitation();
    const [presentAlert] = useIonAlert();

    const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const handleRemoveMember = async (userId: string, userName: string) => {
        if (!householdId) return;

        presentAlert({
            header: "Remove Member",
            message: `Are you sure you want to remove ${userName} from this household?`,
            buttons: [
                "Cancel",
                {
                    text: "Remove",
                    role: "destructive",
                    handler: async () => {
                        await removeMember.mutateAsync({ householdId, userId });
                    },
                },
            ],
        });
    };

    const handleCancelInvitation = async (invitationId: string, email: string) => {
        if (!householdId) return;

        presentAlert({
            header: "Cancel Invitation",
            message: `Are you sure you want to cancel the invitation to ${email}?`,
            buttons: [
                "Cancel",
                {
                    text: "Retract",
                    role: "destructive",
                    handler: async () => {
                        await cancelInvitation.mutateAsync({ householdId, invitationId });
                    },
                },
            ],
        });
    };

    const handleDeleteHousehold = async () => {
        if (!householdId) return;

        presentAlert({
            header: "Delete Household",
            message: "Are you sure you want to delete this household? This cannot be undone.",
            buttons: [
                "Cancel",
                {
                    text: "Delete",
                    role: "destructive",
                    handler: async () => {
                        await deleteHousehold.mutateAsync(householdId);
                        onClose();
                    },
                },
            ],
        });
    };

    const handleLeaveHousehold = async () => {
        if (!householdId || !user?.id) return;

        presentAlert({
            header: "Leave Household",
            message: "Are you sure you want to leave this household?",
            buttons: [
                "Cancel",
                {
                    text: "Leave",
                    role: "destructive",
                    handler: async () => {
                        await removeMember.mutateAsync({ householdId, userId: user.id });
                        onClose();
                    },
                },
            ],
        });
    };

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={onClose}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Household Details</IonTitle>
                        <IonButtons slot="end">
                            <IonButton
                                onClick={handleDeleteHousehold}
                                disabled={deleteHousehold.isPending}
                            >
                                <IonIcon icon={trashOutline} slot="icon-only" />
                            </IonButton>
                            <IonButton onClick={onClose}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    {isLoading ? (
                        <div className="ion-text-center ion-padding">
                            <IonSpinner />
                        </div>
                    ) : null}

                    {error ? (
                        <IonText color="danger">
                            <p className="ion-padding">
                                {error instanceof Error && error.message.includes("404")
                                    ? "Household not found. It may have been deleted."
                                    : "Failed to load household details"}
                            </p>
                        </IonText>
                    ) : null}

                    {!isLoading && !error && household ? (
                        <>
                            {/* Household Details Section */}
                            <IonList>
                                <IonListHeader>
                                    <h2>Household Name</h2>
                                </IonListHeader>
                                <IonItem>
                                    <IonLabel>
                                        <h3>{household.name}</h3>
                                    </IonLabel>
                                    <IonButton
                                        slot="end"
                                        fill="outline"
                                        onClick={() => setIsEditDetailsModalOpen(true)}
                                    >
                                        Edit
                                    </IonButton>
                                </IonItem>
                            </IonList>

                            {/* Members Section */}
                            <IonList>
                                <IonListHeader>
                                    <h2>Members ({household.members.length})</h2>
                                </IonListHeader>
                                <div
                                    className="ion-padding-horizontal"
                                    style={{ marginTop: "-8px", marginBottom: "8px" }}
                                >
                                    <IonButton
                                        expand="block"
                                        fill="outline"
                                        onClick={() => setIsInviteModalOpen(true)}
                                    >
                                        <IonIcon icon={personAddOutline} slot="start" />
                                        Invite Member
                                    </IonButton>
                                </div>

                                {household.members.map((member: HouseholdMemberDetail) => {
                                    const isCurrentUser = member.userId === user?.id;
                                    return (
                                        <IonItem key={member.userId}>
                                            <IonLabel>
                                                <h3>{member.userName || member.userEmail}</h3>
                                                <p>{member.userEmail}</p>
                                            </IonLabel>
                                            {!isCurrentUser ? (
                                                <IonButton
                                                    slot="end"
                                                    fill="clear"
                                                    color="danger"
                                                    onClick={() =>
                                                        handleRemoveMember(
                                                            member.userId,
                                                            member.userName || member.userEmail
                                                        )
                                                    }
                                                    disabled={removeMember.isPending}
                                                >
                                                    <IonIcon icon={trashOutline} slot="icon-only" />
                                                </IonButton>
                                            ) : null}
                                        </IonItem>
                                    );
                                })}

                                {household.members.length === 0 ? (
                                    <IonItem>
                                        <IonLabel>
                                            <IonNote>No members yet</IonNote>
                                        </IonLabel>
                                    </IonItem>
                                ) : null}
                            </IonList>

                            {/* Pending Invitations Section */}
                            {!invitationsLoading && invitations && invitations.length > 0 ? (
                                <IonList>
                                    <IonListHeader>
                                        <h2>Pending Invitations ({invitations.length})</h2>
                                    </IonListHeader>
                                    {invitations.map((invitation: HouseholdInvitation) => (
                                        <IonItem key={invitation.id}>
                                            <IonLabel>
                                                <h3>{invitation.invitedEmail}</h3>
                                            </IonLabel>
                                            <IonButton
                                                slot="end"
                                                fill="clear"
                                                color="danger"
                                                onClick={() =>
                                                    handleCancelInvitation(
                                                        invitation.id,
                                                        invitation.invitedEmail
                                                    )
                                                }
                                                disabled={cancelInvitation.isPending}
                                            >
                                                <IonIcon icon={trashOutline} slot="icon-only" />
                                            </IonButton>
                                        </IonItem>
                                    ))}
                                </IonList>
                            ) : null}

                            {/* Actions Section */}
                            <div className="ion-padding">
                                <IonButton
                                    expand="block"
                                    color="warning"
                                    fill="outline"
                                    onClick={handleLeaveHousehold}
                                    disabled={removeMember.isPending}
                                >
                                    Leave Household
                                </IonButton>
                            </div>
                        </>
                    ) : null}
                </IonContent>
            </IonModal>

            <EditHouseholdDetailsModal
                householdId={householdId}
                currentName={household?.name || ""}
                isOpen={isEditDetailsModalOpen}
                onClose={() => setIsEditDetailsModalOpen(false)}
            />

            <InviteMemberModal
                householdId={householdId}
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
            />
        </>
    );
};

export default HouseholdDetailModal;
