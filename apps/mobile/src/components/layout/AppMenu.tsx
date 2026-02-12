import HouseholdManagementModal from "@/components/households/HouseholdManagementModal";
import PasswordChangeModal from "@/components/settings/PasswordChangeModal";
import ProfileEditorModal from "@/components/settings/ProfileEditorModal";
import SettingsModal from "@/components/settings/SettingsModal";
import StoreListModal from "@/components/store/StoreListModal";
import {
    IonBadge,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import {
    homeOutline,
    keyOutline,
    logOut,
    person,
    settings,
    storefrontOutline,
} from "ionicons/icons";
import { useCallback } from "react";
import { useAuth } from "../../auth/useAuth";
import { usePendingInvitations } from "../../db/hooks";
import { useAppHeader } from "./useAppHeader";

export const AppMenu: React.FC = () => {
    const { openModal } = useAppHeader();
    const { user, logout } = useAuth();
    const { data: pendingInvitations } = usePendingInvitations();

    const handleOpenSettings = useCallback(() => openModal("settings"), [openModal]);
    const handleOpenProfile = useCallback(() => openModal("profile"), [openModal]);
    const handleOpenPassword = useCallback(() => openModal("password"), [openModal]);
    const handleOpenHouseholds = useCallback(() => openModal("households"), [openModal]);
    const handleOpenStores = useCallback(() => openModal("stores"), [openModal]);

    const handleLogout = async () => {
        try {
            await logout();
            // router.push("/login", "root", "replace");
            // Force full page reload to completely clear navigation stack
            // THIS IS IMPORTANT to prevent Ionic from displaying a blank page after logout
            // RIP 2 hours on this.
            window.location.href = "/login";
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <>
            <IonMenu contentId="main-content" type="overlay">
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                <img
                                    src="/img/icon.png"
                                    alt="Basket Bot"
                                    style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                    }}
                                />
                                <span>Basket Bot</span>
                            </div>
                        </IonTitle>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    {user && (
                        <div
                            style={{
                                padding: "20px 16px",
                                borderBottom: "1px solid var(--ion-color-light)",
                            }}
                        >
                            <div
                                style={{ fontSize: "18px", fontWeight: "600", marginBottom: "4px" }}
                            >
                                {user.name}
                            </div>
                            <div style={{ fontSize: "14px", color: "var(--ion-color-medium)" }}>
                                {user.email}
                            </div>
                        </div>
                    )}
                    <IonList>
                        <IonMenuToggle autoHide={false}>
                            <IonItem button onClick={handleOpenSettings} lines="none">
                                <IonIcon icon={settings} slot="start" />
                                <IonLabel>Settings</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                        <IonMenuToggle autoHide={false}>
                            <IonItem button onClick={handleOpenProfile} lines="none">
                                <IonIcon icon={person} slot="start" />
                                <IonLabel>Profile</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                        <IonMenuToggle autoHide={false}>
                            <IonItem button onClick={handleOpenPassword} lines="none">
                                <IonIcon icon={keyOutline} slot="start" />
                                <IonLabel>Change Password</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                        <IonMenuToggle autoHide={false}>
                            <IonItem button onClick={handleOpenHouseholds} lines="none">
                                <IonIcon icon={homeOutline} slot="start" />
                                <IonLabel>Households</IonLabel>
                                {pendingInvitations && pendingInvitations.length > 0 ? (
                                    <IonBadge color="primary" slot="end">
                                        {pendingInvitations.length}
                                    </IonBadge>
                                ) : null}
                            </IonItem>
                        </IonMenuToggle>
                        <IonMenuToggle autoHide={false}>
                            <IonItem button onClick={handleOpenStores} lines="none">
                                <IonIcon icon={storefrontOutline} slot="start" />
                                <IonLabel>Stores</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                    </IonList>
                    <div style={{ padding: "16px", marginTop: "auto" }}>
                        <IonButton expand="block" color="danger" onClick={handleLogout}>
                            <IonIcon icon={logOut} slot="start" />
                            Log Out
                        </IonButton>
                    </div>
                </IonContent>
            </IonMenu>
            <SettingsModal />
            <ProfileEditorModal />
            <PasswordChangeModal />
            <StoreListModal />
            <HouseholdManagementModal />
        </>
    );
};
