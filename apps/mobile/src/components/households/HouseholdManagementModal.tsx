import type { Household, InvitationDetail } from "@basket-bot/core";
import { IonButton, IonContent, IonIcon, IonModal } from "@ionic/react";
import {
    addOutline,
    checkmarkOutline,
    chevronForward,
    closeOutline,
    homeOutline,
} from "ionicons/icons";
import React, { useState } from "react";
import {
    useAcceptInvitation,
    useDeclineInvitation,
    useHouseholds,
    usePendingInvitations,
} from "../../db/hooks";
import { useHousehold } from "../../households/useHousehold";
import { useAppHeader } from "../layout/useAppHeader";
import { EditorFooter } from "../shared/EditorFooter";
import { ModalHeader } from "../shared/ModalHeader";
import RobotLoadingContent from "../shared/RobotLoadingContent";
import TabEmptyState from "../shared/TabEmptyState";
import CreateHouseholdModal from "./CreateHouseholdModal";
import HouseholdDetailModal from "./HouseholdDetailModal";

import "./Households.scss";

export const HouseholdManagementModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();
    const { refreshHouseholds } = useHousehold();
    const {
        data: households,
        isLoading: householdsLoading,
        error: householdsError,
    } = useHouseholds();
    const { data: invitations, error: invitationsError } = usePendingInvitations();
    const acceptInvitation = useAcceptInvitation();
    const declineInvitation = useDeclineInvitation();

    const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleAcceptInvitation = async (token: string) => {
        await acceptInvitation.mutateAsync(token);
        await refreshHouseholds();
    };

    const handleDeclineInvitation = async (token: string) => {
        await declineInvitation.mutateAsync(token);
    };

    const hasInvitations = !!invitations && invitations.length > 0;
    const hasHouseholds = !!households && households.length > 0;

    return (
        <>
            <IonModal isOpen={isModalOpen("households")} onDidDismiss={closeModal}>
                <ModalHeader title="Households" onClose={closeModal} />
                <IonContent className="ion-padding">
                    {householdsLoading ? (
                        <div className="household-loading">
                            <RobotLoadingContent />
                        </div>
                    ) : (
                        <div className="household-sheet">
                            {invitationsError ? (
                                <p className="household-error" role="alert">
                                    Invitations failed to load.
                                </p>
                            ) : null}

                            {hasInvitations ? (
                                <section className="household-section">
                                    <h2 className="ruled-label">
                                        Invitations{" "}
                                        <span className="ruled-label__count">
                                            {invitations.length}
                                        </span>
                                    </h2>
                                    <div className="household-invites">
                                        {invitations.map((invitation: InvitationDetail) => (
                                            <article
                                                key={invitation.token}
                                                className="surface-card household-invite"
                                            >
                                                <div className="household-invite__body">
                                                    <h3 className="household-invite__name">
                                                        {invitation.householdName}
                                                    </h3>
                                                    <p className="household-invite__meta">
                                                        Invited by {invitation.inviterName}
                                                    </p>
                                                </div>
                                                <div className="card-actions">
                                                    <button
                                                        type="button"
                                                        className="card-actions__btn"
                                                        onClick={() =>
                                                            handleDeclineInvitation(
                                                                invitation.token
                                                            )
                                                        }
                                                        disabled={declineInvitation.isPending}
                                                        aria-label={`Decline invitation to ${invitation.householdName}`}
                                                    >
                                                        <IonIcon
                                                            icon={closeOutline}
                                                            aria-hidden="true"
                                                        />
                                                        Decline
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="card-actions__btn card-actions__btn--primary"
                                                        onClick={() =>
                                                            handleAcceptInvitation(invitation.token)
                                                        }
                                                        disabled={acceptInvitation.isPending}
                                                        aria-label={`Accept invitation to ${invitation.householdName}`}
                                                    >
                                                        <IonIcon
                                                            icon={checkmarkOutline}
                                                            aria-hidden="true"
                                                        />
                                                        Accept
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            ) : null}

                            <section className="household-section">
                                <h2 className="ruled-label">
                                    My households{" "}
                                    {hasHouseholds ? (
                                        <span className="ruled-label__count">
                                            {households.length}
                                        </span>
                                    ) : null}
                                </h2>

                                {householdsError ? (
                                    <p className="household-error" role="alert">
                                        Households failed to load.
                                    </p>
                                ) : hasHouseholds ? (
                                    <ul className="boxed-list">
                                        {households.map((household: Household) => (
                                            <li key={household.id}>
                                                <button
                                                    type="button"
                                                    className="row-button household-row"
                                                    onClick={() =>
                                                        setSelectedHouseholdId(household.id)
                                                    }
                                                >
                                                    <span className="household-row__name">
                                                        {household.name}
                                                    </span>
                                                    <IonIcon
                                                        className="household-row__trail"
                                                        icon={chevronForward}
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <TabEmptyState
                                        variant="inline"
                                        icon={homeOutline}
                                        title="No households"
                                        body="None on record. Create one to share recipes, tags and meal plans."
                                    />
                                )}
                            </section>
                        </div>
                    )}
                </IonContent>
                <EditorFooter>
                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        <IonIcon icon={addOutline} slot="start" />
                        Create Household
                    </IonButton>
                </EditorFooter>
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
