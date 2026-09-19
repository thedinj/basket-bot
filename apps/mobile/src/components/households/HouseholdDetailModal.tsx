import type { HouseholdInvitation, HouseholdMemberDetail } from "@basket-bot/core";
import { IonButton, IonContent, IonIcon, IonModal, useIonAlert } from "@ionic/react";
import { chevronForward, createOutline, personAddOutline } from "ionicons/icons";
import React, { useState } from "react";
import { useAuth } from "../../auth/useAuth";
import {
    useCancelInvitation,
    useDeleteHousehold,
    useHouseholdDetail,
    useHouseholdInvitations,
    useRemoveMember,
} from "../../db/hooks";
import { useHousehold } from "../../households/useHousehold";
import TagManagerModal from "../meals/TagManagerModal";
import { DestructiveAction } from "../shared/DestructiveAction";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";
import RobotLoadingContent from "../shared/RobotLoadingContent";
import { RowRemoveButton } from "../shared/RowRemoveButton";
import EditHouseholdDetailsModal from "./EditHouseholdDetailsModal";
import InviteMemberModal from "./InviteMemberModal";

import "./Households.scss";

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
    const { refreshHouseholds } = useHousehold();
    const { data: household, isLoading, error } = useHouseholdDetail(householdId);
    const { data: invitations, isLoading: invitationsLoading } =
        useHouseholdInvitations(householdId);
    const deleteHousehold = useDeleteHousehold();
    const removeMember = useRemoveMember();
    const cancelInvitation = useCancelInvitation();
    const [presentAlert] = useIonAlert();

    const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

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
                        await refreshHouseholds();
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
                        await refreshHouseholds();
                        onClose();
                    },
                },
            ],
        });
    };

    const pendingInvitations = !invitationsLoading && invitations ? invitations : [];

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={onClose}>
                <ModalHeader title="Household" onClose={onClose} />
                <IonContent className="ion-padding">
                    {isLoading ? (
                        <div className="household-loading">
                            <RobotLoadingContent />
                        </div>
                    ) : null}

                    {error ? (
                        <p className="household-error" role="alert">
                            {error instanceof Error && error.message.includes("404")
                                ? "Household not found. It may have been deleted."
                                : "Household details failed to load."}
                        </p>
                    ) : null}

                    {!isLoading && !error && household ? (
                        <div className="household-sheet">
                            <FormField label="Name">
                                <button
                                    type="button"
                                    className="form-control form-control--button"
                                    onClick={() => setIsEditDetailsModalOpen(true)}
                                    aria-label={`Rename ${household.name}`}
                                >
                                    <span className="form-control__value">{household.name}</span>
                                    <IonIcon
                                        className="form-control__trail"
                                        icon={createOutline}
                                        aria-hidden="true"
                                    />
                                </button>
                            </FormField>

                            <section className="household-section">
                                <h2 className="ruled-label">
                                    Members{" "}
                                    <span className="ruled-label__count">
                                        {household.members.length}
                                    </span>
                                </h2>
                                {household.members.length > 0 ? (
                                    <ul className="boxed-list">
                                        {household.members.map((member: HouseholdMemberDetail) => {
                                            const isCurrentUser = member.userId === user?.id;
                                            const displayName = member.userName || member.userEmail;
                                            return (
                                                <li key={member.userId} className="household-row">
                                                    <div className="household-row__text">
                                                        <div className="household-row__title">
                                                            <span className="household-row__name">
                                                                {displayName}
                                                            </span>
                                                            {isCurrentUser ? (
                                                                <span className="info-pill">
                                                                    You
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {member.userName ? (
                                                            <span className="household-row__meta">
                                                                {member.userEmail}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {!isCurrentUser ? (
                                                        <RowRemoveButton
                                                            onClick={() =>
                                                                handleRemoveMember(
                                                                    member.userId,
                                                                    displayName
                                                                )
                                                            }
                                                            disabled={removeMember.isPending}
                                                            label={`Remove ${displayName}`}
                                                        />
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="household-row__meta">No members.</p>
                                )}
                            </section>

                            {pendingInvitations.length > 0 ? (
                                <section className="household-section">
                                    <h2 className="ruled-label">
                                        Invitations{" "}
                                        <span className="ruled-label__count">
                                            {pendingInvitations.length}
                                        </span>
                                    </h2>
                                    <ul className="boxed-list">
                                        {pendingInvitations.map(
                                            (invitation: HouseholdInvitation) => (
                                                <li key={invitation.id} className="household-row">
                                                    <div className="household-row__title">
                                                        <span className="household-row__name">
                                                            {invitation.invitedEmail}
                                                        </span>
                                                        <span className="info-pill">Pending</span>
                                                    </div>
                                                    <RowRemoveButton
                                                        onClick={() =>
                                                            handleCancelInvitation(
                                                                invitation.id,
                                                                invitation.invitedEmail
                                                            )
                                                        }
                                                        disabled={cancelInvitation.isPending}
                                                        label={`Retract invitation to ${invitation.invitedEmail}`}
                                                    />
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </section>
                            ) : null}

                            <section className="household-section">
                                <h2 className="ruled-label">Recipe tags</h2>
                                <ul className="boxed-list">
                                    <li>
                                        <button
                                            type="button"
                                            className="row-button household-row"
                                            onClick={() => setIsTagManagerOpen(true)}
                                        >
                                            <span className="household-row__name">Manage tags</span>
                                            <IonIcon
                                                className="household-row__trail"
                                                icon={chevronForward}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </li>
                                </ul>
                            </section>

                            {/* The destructive zone: leave (when others remain to keep it),
                                then delete. */}
                            <div className="household-danger">
                                {household.members.length > 1 && (
                                    <DestructiveAction
                                        onClick={handleLeaveHousehold}
                                        disabled={removeMember.isPending}
                                    >
                                        Leave household
                                    </DestructiveAction>
                                )}
                                <DestructiveAction
                                    onClick={handleDeleteHousehold}
                                    busy={deleteHousehold.isPending}
                                >
                                    Delete household
                                </DestructiveAction>
                            </div>
                        </div>
                    ) : null}
                </IonContent>
                {!isLoading && !error && household ? (
                    <EditorFooter>
                        <IonButton
                            className="editor-form__submit"
                            expand="block"
                            onClick={() => setIsInviteModalOpen(true)}
                        >
                            <IonIcon icon={personAddOutline} slot="start" />
                            Invite Member
                        </IonButton>
                    </EditorFooter>
                ) : null}
            </IonModal>

            <TagManagerModal
                isOpen={isTagManagerOpen}
                onDismiss={() => setIsTagManagerOpen(false)}
                householdId={householdId}
            />

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
