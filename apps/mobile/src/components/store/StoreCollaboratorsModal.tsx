import type { StoreCollaboratorDetail } from "@basket-bot/core";
import {
    IonAlert,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline, personAddOutline, refreshOutline } from "ionicons/icons";
import { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import {
    useOutgoingStoreInvitations,
    useRemoveStoreCollaborator,
    useRetractStoreInvitation,
    useStoreCollaborators,
    useUpdateStoreCollaboratorRole,
} from "../../db/hooks";
import { InviteStoreCollaboratorModal } from "./InviteStoreCollaboratorModal";

interface StoreCollaboratorsModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    storeId: string;
    userRole: "owner" | "editor";
}

export const StoreCollaboratorsModal: React.FC<StoreCollaboratorsModalProps> = ({
    isOpen,
    onDismiss,
    storeId,
    userRole,
}) => {
    const { user } = useAuth();
    const { data: collaborators, isLoading, refetch } = useStoreCollaborators(storeId);
    const {
        data: invitations,
        isLoading: invitationsLoading,
        refetch: refetchInvitations,
    } = useOutgoingStoreInvitations(storeId);
    const updateRole = useUpdateStoreCollaboratorRole();
    const removeCollaborator = useRemoveStoreCollaborator();
    const retractInvitation = useRetractStoreInvitation();

    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [removeConfirm, setRemoveConfirm] = useState<StoreCollaboratorDetail | null>(null);
    const [retractConfirm, setRetractConfirm] = useState<{
        id: string;
        email: string;
    } | null>(null);

    const handleRefreshAll = () => {
        refetch();
        refetchInvitations();
    };

    const handleRoleChange = async (
        collaborator: StoreCollaboratorDetail,
        newRole: "owner" | "editor"
    ) => {
        await updateRole.mutateAsync({
            storeId,
            collaboratorUserId: collaborator.userId,
            role: newRole,
        });
    };

    const handleRemove = async (collaborator: StoreCollaboratorDetail) => {
        await removeCollaborator.mutateAsync({
            storeId,
            collaboratorUserId: collaborator.userId,
        });
        setRemoveConfirm(null);
    };

    const handleRetract = async (invitationId: string) => {
        await retractInvitation.mutateAsync({
            storeId,
            invitationId,
        });
        setRetractConfirm(null);
    };

    const isOwner = userRole === "owner";
    const isCurrentUser = (collaborator: StoreCollaboratorDetail) =>
        collaborator.userId === user?.id;

    const canRetractInvitation = (invitation: { invitedById: string }) => {
        // Only owner or original inviter can retract
        return isOwner || invitation.invitedById === user?.id;
    };

    const formatDate = (isoDate: string) => {
        const date = new Date(isoDate);
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        });
    };

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Manage Collaborators</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={handleRefreshAll}>
                                <IonIcon icon={refreshOutline} />
                            </IonButton>
                            <IonButton onClick={onDismiss}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    <IonList>
                        {isLoading ? (
                            <>
                                {[1, 2, 3].map((i) => (
                                    <IonItem key={i}>
                                        <IonLabel>
                                            <IonSkeletonText animated style={{ width: "60%" }} />
                                            <IonSkeletonText animated style={{ width: "40%" }} />
                                        </IonLabel>
                                    </IonItem>
                                ))}
                            </>
                        ) : (
                            <>
                                {collaborators?.map((collaborator) => (
                                    <IonItem key={collaborator.id}>
                                        <IonLabel>
                                            <h2>{collaborator.userName}</h2>
                                            <p>{collaborator.userEmail}</p>
                                            {isCurrentUser(collaborator) && (
                                                <IonNote color="primary">(You)</IonNote>
                                            )}
                                        </IonLabel>

                                        {isOwner && !isCurrentUser(collaborator) ? (
                                            <div slot="end" style={{ display: "flex", gap: "8px" }}>
                                                <IonSelect
                                                    value={collaborator.role}
                                                    onIonChange={(e) =>
                                                        handleRoleChange(
                                                            collaborator,
                                                            e.detail.value
                                                        )
                                                    }
                                                    interface="popover"
                                                >
                                                    <IonSelectOption value="editor">
                                                        Editor
                                                    </IonSelectOption>
                                                    <IonSelectOption value="owner">
                                                        Owner
                                                    </IonSelectOption>
                                                </IonSelect>
                                                <IonButton
                                                    fill="clear"
                                                    color="danger"
                                                    onClick={() => setRemoveConfirm(collaborator)}
                                                >
                                                    Remove
                                                </IonButton>
                                            </div>
                                        ) : (
                                            <IonBadge
                                                slot="end"
                                                color={
                                                    collaborator.role === "owner"
                                                        ? "primary"
                                                        : "medium"
                                                }
                                            >
                                                {collaborator.role}
                                            </IonBadge>
                                        )}
                                    </IonItem>
                                ))}
                            </>
                        )}
                    </IonList>

                    {/* Pending Invitations Section - only show if there are invitations */}
                    {invitations && invitations.length > 0 && (
                        <IonList>
                            <IonItemDivider>
                                <IonLabel>Pending Invitations</IonLabel>
                            </IonItemDivider>
                            {invitationsLoading ? (
                                <>
                                    {[1, 2].map((i) => (
                                        <IonItem key={i}>
                                            <IonLabel>
                                                <IonSkeletonText animated style={{ width: "60%" }} />
                                                <IonSkeletonText animated style={{ width: "40%" }} />
                                            </IonLabel>
                                        </IonItem>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {invitations.map((invitation) => (
                                        <IonItem key={invitation.id}>
                                            <IonLabel>
                                                <h2>{invitation.invitedEmail}</h2>
                                                <p>
                                                    Invited by {invitation.inviterName} •{" "}
                                                    {formatDate(invitation.createdAt)}
                                                </p>
                                            </IonLabel>

                                            <IonBadge
                                                slot="end"
                                                color={
                                                    invitation.role === "owner" ? "primary" : "medium"
                                                }
                                                style={{ marginRight: "8px" }}
                                            >
                                                {invitation.role}
                                            </IonBadge>

                                            {canRetractInvitation(invitation) && (
                                                <IonButton
                                                    slot="end"
                                                    fill="clear"
                                                    color="danger"
                                                    onClick={() =>
                                                        setRetractConfirm({
                                                            id: invitation.id,
                                                            email: invitation.invitedEmail,
                                                        })
                                                    }
                                                >
                                                    Cancel
                                                </IonButton>
                                            )}
                                        </IonItem>
                                    ))}
                                </>
                            )}
                        </IonList>
                    )}

                    <div className="ion-padding">
                        <IonButton expand="block" onClick={() => setInviteModalOpen(true)}>
                            <IonIcon slot="start" icon={personAddOutline} />
                            Invite Collaborator
                        </IonButton>
                    </div>
                </IonContent>
            </IonModal>

            <InviteStoreCollaboratorModal
                isOpen={inviteModalOpen}
                onDismiss={() => setInviteModalOpen(false)}
                storeId={storeId}
            />

            <IonAlert
                isOpen={!!removeConfirm}
                onDidDismiss={() => setRemoveConfirm(null)}
                header="Remove Collaborator"
                message={`Are you sure you want to remove ${removeConfirm?.userName} from this store?`}
                buttons={[
                    {
                        text: "Cancel",
                        role: "cancel",
                    },
                    {
                        text: "Remove",
                        role: "destructive",
                        handler: () => {
                            if (removeConfirm) {
                                handleRemove(removeConfirm);
                            }
                        },
                    },
                ]}
            />

            <IonAlert
                isOpen={!!retractConfirm}
                onDidDismiss={() => setRetractConfirm(null)}
                header="Cancel Invitation"
                message={`Are you sure you want to cancel the invitation for ${retractConfirm?.email}?`}
                buttons={[
                    {
                        text: "No",
                        role: "cancel",
                    },
                    {
                        text: "Yes, Cancel",
                        role: "destructive",
                        handler: () => {
                            if (retractConfirm) {
                                handleRetract(retractConfirm.id);
                            }
                        },
                    },
                ]}
            />
        </>
    );
};
