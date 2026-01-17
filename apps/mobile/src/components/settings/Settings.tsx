import {
    IonBadge,
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
import { addOutline, closeOutline, mailOutline, peopleOutline } from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";
import { useResetDatabase } from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { useHousehold } from "../../households/useHousehold";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { useAppHeader } from "../layout/useAppHeader";
import { HouseholdInvitationsModal } from "./HouseholdInvitationsModal";
import { HouseholdMembersModal } from "./HouseholdMembersModal";
import { InviteMemberModal } from "./InviteMemberModal";

const Settings: React.FC = () => {
    const { showSuccess } = useToast();
    const { mutateAsync: resetDatabase } = useResetDatabase();
    const { form, onSubmit, isSubmitting } = useSettingsForm();
    const { isSettingsOpen, closeSettings } = useAppHeader();
    const {
        activeHousehold,
        pendingInvitationsCount,
        isLoading: householdsLoading,
    } = useHousehold();

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showInvitationsModal, setShowInvitationsModal] = useState(false);

    // Reset form to original values when modal opens
    useEffect(() => {
        if (isSettingsOpen) {
            form.reset();
        }
    }, [isSettingsOpen, form]);

    const resetOnClick = useCallback(async () => {
        try {
            await resetDatabase(undefined);
            showSuccess("Database reset successfully");
        } catch (error) {
            // Error toast is automatically shown by mutation hook
            console.error("Database reset error:", error);
        }
    }, [resetDatabase, showSuccess]);

    const handleSubmit = form.handleSubmit(async () => {
        await onSubmit();
        closeSettings();
    });

    return (
        <IonModal isOpen={isSettingsOpen} onDidDismiss={closeSettings}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Settings</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeSettings}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit}>
                    {/* Household Section */}
                    <IonList>
                        <IonListHeader>
                            <h2>Household</h2>
                        </IonListHeader>

                        {householdsLoading ? (
                            <div className="ion-padding">
                                <IonLabel color="medium">Loading household...</IonLabel>
                            </div>
                        ) : activeHousehold ? (
                            <>
                                <IonItem lines="none">
                                    <IonLabel>
                                        <h3>Current Household</h3>
                                        <p
                                            style={{
                                                fontSize: "16px",
                                                fontWeight: "600",
                                                marginTop: "4px",
                                            }}
                                        >
                                            {activeHousehold.name}
                                        </p>
                                    </IonLabel>
                                </IonItem>

                                <div className="ion-padding" style={{ paddingTop: 0 }}>
                                    <IonButton
                                        expand="block"
                                        fill="outline"
                                        onClick={() => setShowMembersModal(true)}
                                    >
                                        <IonIcon icon={peopleOutline} slot="start" />
                                        Manage Members
                                    </IonButton>

                                    <IonButton
                                        expand="block"
                                        fill="outline"
                                        onClick={() => setShowInviteModal(true)}
                                        style={{ marginTop: "8px" }}
                                    >
                                        <IonIcon icon={addOutline} slot="start" />
                                        Invite Someone
                                    </IonButton>

                                    <IonButton
                                        expand="block"
                                        fill="outline"
                                        onClick={() => setShowInvitationsModal(true)}
                                        style={{ marginTop: "8px" }}
                                    >
                                        <IonIcon icon={mailOutline} slot="start" />
                                        My Invitations
                                        {pendingInvitationsCount > 0 && (
                                            <IonBadge color="danger" style={{ marginLeft: "8px" }}>
                                                {pendingInvitationsCount}
                                            </IonBadge>
                                        )}
                                    </IonButton>
                                </div>

                                {/* Household Management Modals */}
                                <InviteMemberModal
                                    isOpen={showInviteModal}
                                    onClose={() => setShowInviteModal(false)}
                                    householdId={activeHousehold?.id || ""}
                                />
                                <HouseholdMembersModal
                                    isOpen={showMembersModal}
                                    onClose={() => setShowMembersModal(false)}
                                    householdId={activeHousehold?.id || ""}
                                />
                                <HouseholdInvitationsModal
                                    isOpen={showInvitationsModal}
                                    onClose={() => setShowInvitationsModal(false)}
                                />
                            </>
                        ) : (
                            <div className="ion-padding">
                                <IonLabel color="medium">
                                    <p>
                                        No household selected. Create one or accept an invitation to
                                        get started.
                                    </p>
                                </IonLabel>
                            </div>
                        )}
                    </IonList>

                    {/* API Settings Section */}
                    <IonList>
                        <IonListHeader>
                            <h2>
                                <span style={{ color: LLM_COLOR }}>
                                    <IonIcon
                                        src={LLM_ICON_SRC}
                                        style={{
                                            position: "relative",
                                            top: "3px",
                                        }}
                                    />
                                </span>{" "}
                                API Configuration
                            </h2>
                        </IonListHeader>

                        <FormPasswordInput
                            name="openaiApiKey"
                            control={form.control}
                            label="OpenAI API Key"
                            placeholder="sk-..."
                            helperText="Enter your OpenAI API key for AI-powered features"
                            disabled={isSubmitting}
                        />

                        <div className="ion-padding">
                            <IonButton expand="block" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save Settings"}
                            </IonButton>
                        </div>
                    </IonList>

                    {/* Database Section */}
                    {import.meta.env.VITE_SHOW_DATABASE_RESET === "true" && (
                        <IonList>
                            <IonListHeader>
                                <h2>Database</h2>
                            </IonListHeader>
                            <div className="ion-padding">
                                <IonButton expand="block" color="danger" onClick={resetOnClick}>
                                    Reset Database
                                </IonButton>
                            </div>
                        </IonList>
                    )}
                </form>
            </IonContent>
        </IonModal>
    );
};

export default Settings;
