import HouseholdManagementModal from "@/components/households/HouseholdManagementModal";
import AboutModal from "@/components/settings/AboutModal";
import PasswordChangeModal from "@/components/settings/PasswordChangeModal";
import ProfileEditorModal from "@/components/settings/ProfileEditorModal";
import SettingsModal from "@/components/settings/SettingsModal";
import StoreListModal from "@/components/store/StoreListModal";
import {
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenu,
    IonMenuToggle,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import {
    helpCircleOutline,
    homeOutline,
    informationCircleOutline,
    keyOutline,
    logOutOutline,
    personOutline,
    settingsOutline,
} from "ionicons/icons";
import { useAuth } from "../../auth/useAuth";
import { usePendingInvitations } from "../../db/hooks";
import { EditorFooter } from "../shared/EditorFooter";
import { UnsureItemsModal } from "../shoppinglist/UnsureItemsModal";
import type { ModalName } from "./AppHeaderContext";
import { useAppHeader } from "./useAppHeader";
import "./AppMenu.scss";

type MenuRowProps = {
    label: string;
    modal: ModalName;
    icon?: string;
    iconSrc?: string;
    /** Pending count shown as a pill at the row's end; hidden when zero. */
    count?: number;
    countLabel?: string;
};

/** One menu row: glyph on the gutter, label, optional count pill on the right gutter. */
const MenuRow: React.FC<MenuRowProps> = ({ label, modal, icon, iconSrc, count, countLabel }) => {
    const { openModal } = useAppHeader();
    return (
        <IonMenuToggle autoHide={false} className="app-menu__toggle">
            <button
                type="button"
                className="row-button app-menu__row"
                onClick={() => openModal(modal)}
            >
                <IonIcon className="app-menu__icon" icon={icon} src={iconSrc} aria-hidden="true" />
                <span className="app-menu__label">{label}</span>
                {count ? (
                    <>
                        <span className="app-menu__badge" aria-hidden="true">
                            {count}
                        </span>
                        <span className="sr-only">
                            , {count} {countLabel}
                        </span>
                    </>
                ) : null}
            </button>
        </IonMenuToggle>
    );
};

export const AppMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const { data: pendingInvitations } = usePendingInvitations();
    const invitationCount = pendingInvitations?.length ?? 0;

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
            <IonMenu contentId="main-content" type="overlay" className="app-menu">
                <IonHeader>
                    <IonToolbar>
                        <IonTitle className="app-menu__title">
                            <span className="app-menu__brand">
                                <img className="app-menu__logo" src="/img/icon.png" alt="" />
                                Basket Bot
                            </span>
                        </IonTitle>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    {user && (
                        <div className="app-menu__user">
                            <p className="app-menu__user-name">{user.name}</p>
                            <p className="app-menu__user-email">{user.email}</p>
                        </div>
                    )}
                    <nav className="app-menu__nav" aria-label="Main menu">
                        <section className="app-menu__group">
                            <h2 className="ruled-label app-menu__group-label">Account</h2>
                            <MenuRow label="Profile" modal="profile" icon={personOutline} />
                            <MenuRow label="Change Password" modal="password" icon={keyOutline} />
                        </section>
                        <section className="app-menu__group">
                            <h2 className="ruled-label app-menu__group-label">Shopping</h2>
                            <MenuRow label="Stores" modal="stores" iconSrc="/img/Store.svg" />
                            <MenuRow
                                label="Households"
                                modal="households"
                                icon={homeOutline}
                                count={invitationCount}
                                countLabel={
                                    invitationCount === 1
                                        ? "pending invitation"
                                        : "pending invitations"
                                }
                            />
                            <MenuRow
                                label="Review Unsure Items"
                                modal="unsureItems"
                                icon={helpCircleOutline}
                            />
                        </section>
                        <section className="app-menu__group">
                            <h2 className="ruled-label app-menu__group-label">System</h2>
                            <MenuRow label="Settings" modal="settings" icon={settingsOutline} />
                            <MenuRow label="About" modal="about" icon={informationCircleOutline} />
                        </section>
                    </nav>
                </IonContent>
                <EditorFooter>
                    <IonButton
                        className="editor-form__submit app-menu__logout"
                        expand="block"
                        fill="outline"
                        color="danger"
                        onClick={handleLogout}
                    >
                        <IonIcon icon={logOutOutline} slot="start" aria-hidden="true" />
                        Log Out
                    </IonButton>
                </EditorFooter>
            </IonMenu>
            <SettingsModal />
            <ProfileEditorModal />
            <PasswordChangeModal />
            <StoreListModal />
            <HouseholdManagementModal />
            <UnsureItemsModal />
            <AboutModal />
        </>
    );
};
