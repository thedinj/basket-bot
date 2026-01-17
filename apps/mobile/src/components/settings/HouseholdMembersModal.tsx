import type { HouseholdMemberDetail, HouseholdRole } from "@basket-bot/core";
import {
    IonAlert,
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
import { closeOutline, personRemoveOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { householdApi } from "../../lib/api/household";

interface HouseholdMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    householdId: string;
}

export const HouseholdMembersModal: React.FC<HouseholdMembersModalProps> = ({
    isOpen,
    onClose,
    householdId,
}) => {
    const [members, setMembers] = useState<HouseholdMemberDetail[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<HouseholdMemberDetail | null>(null);
    const [memberToChangeRole, setMemberToChangeRole] = useState<HouseholdMemberDetail | null>(
        null
    );
    const [newRole, setNewRole] = useState<HouseholdRole>("viewer");
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const loadMembers = async () => {
        if (!householdId) return;

        setIsLoading(true);
        try {
            const data = await householdApi.getHouseholdMembers(householdId);
            setMembers(data);
        } catch (error) {
            console.error("Error loading members:", error);
            showError("Failed to load members");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && householdId) {
            loadMembers();
        }
    }, [isOpen, householdId]);

    const currentUserMember = members.find((m) => m.userId === user?.id);
    const isOwner = currentUserMember?.role === "owner";

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;

        try {
            await householdApi.removeMember(householdId, memberToRemove.userId);
            showSuccess("Member removed successfully");
            setMemberToRemove(null);
            await loadMembers();
        } catch (error: any) {
            console.error("Error removing member:", error);
            showError(error.message || "Failed to remove member");
        }
    };

    const handleChangeRole = async () => {
        if (!memberToChangeRole) return;

        try {
            await householdApi.updateMemberRole(householdId, memberToChangeRole.userId, newRole);
            showSuccess("Member role updated successfully");
            setMemberToChangeRole(null);
            await loadMembers();
        } catch (error: any) {
            console.error("Error updating role:", error);
            showError(error.message || "Failed to update role");
        }
    };

    const getRoleBadgeColor = (role: HouseholdRole) => {
        switch (role) {
            case "owner":
                return "danger";
            case "editor":
                return "warning";
            case "viewer":
                return "medium";
            default:
                return "medium";
        }
    };

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={onClose}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Household Members</IonTitle>
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
                            <IonLabel color="medium">Loading members...</IonLabel>
                        </div>
                    ) : members.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 20px" }}>
                            <IonLabel color="medium">
                                <p>No members found</p>
                            </IonLabel>
                        </div>
                    ) : (
                        <IonList>
                            <IonListHeader>
                                <h2>
                                    {members.length} Member{members.length !== 1 ? "s" : ""}
                                </h2>
                            </IonListHeader>
                            {members.map((member) => {
                                const isCurrentUser = member.userId === user?.id;
                                return (
                                    <IonItem key={member.id} lines="full">
                                        <IonLabel>
                                            <h2>
                                                {member.userName}
                                                {isCurrentUser && (
                                                    <span
                                                        style={{
                                                            color: "var(--ion-color-medium)",
                                                            fontSize: "14px",
                                                        }}
                                                    >
                                                        {" "}
                                                        (You)
                                                    </span>
                                                )}
                                            </h2>
                                            <p>{member.userEmail}</p>
                                        </IonLabel>
                                        <IonBadge
                                            color={getRoleBadgeColor(member.role)}
                                            slot="end"
                                            style={{ marginRight: "8px" }}
                                        >
                                            {member.role}
                                        </IonBadge>
                                        {isOwner && !isCurrentUser && (
                                            <div slot="end" style={{ display: "flex", gap: "4px" }}>
                                                <IonButton
                                                    size="small"
                                                    fill="clear"
                                                    onClick={() => {
                                                        setMemberToChangeRole(member);
                                                        setNewRole(member.role);
                                                    }}
                                                >
                                                    <IonIcon
                                                        icon={shieldCheckmarkOutline}
                                                        slot="icon-only"
                                                    />
                                                </IonButton>
                                                <IonButton
                                                    size="small"
                                                    fill="clear"
                                                    color="danger"
                                                    onClick={() => setMemberToRemove(member)}
                                                >
                                                    <IonIcon
                                                        icon={personRemoveOutline}
                                                        slot="icon-only"
                                                    />
                                                </IonButton>
                                            </div>
                                        )}
                                    </IonItem>
                                );
                            })}
                        </IonList>
                    )}
                </IonContent>
            </IonModal>

            {/* Remove Member Confirmation */}
            <IonAlert
                isOpen={!!memberToRemove}
                onDidDismiss={() => setMemberToRemove(null)}
                header="Remove Member"
                message={`Are you sure you want to remove ${memberToRemove?.userName} from this household?`}
                buttons={[
                    {
                        text: "Cancel",
                        role: "cancel",
                    },
                    {
                        text: "Remove",
                        role: "destructive",
                        handler: handleRemoveMember,
                    },
                ]}
            />

            {/* Change Role Alert */}
            <IonAlert
                isOpen={!!memberToChangeRole}
                onDidDismiss={() => setMemberToChangeRole(null)}
                header="Change Member Role"
                message={`Change role for ${memberToChangeRole?.userName}`}
                inputs={[
                    {
                        name: "role",
                        type: "radio",
                        label: "Viewer",
                        value: "viewer",
                        checked: newRole === "viewer",
                    },
                    {
                        name: "role",
                        type: "radio",
                        label: "Editor",
                        value: "editor",
                        checked: newRole === "editor",
                    },
                    {
                        name: "role",
                        type: "radio",
                        label: "Owner",
                        value: "owner",
                        checked: newRole === "owner",
                    },
                ]}
                buttons={[
                    {
                        text: "Cancel",
                        role: "cancel",
                    },
                    {
                        text: "Update",
                        handler: (data) => {
                            setNewRole(data.role);
                            handleChangeRole();
                        },
                    },
                ]}
            />
        </>
    );
};
