import { type ChangePasswordRequest } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useEffect } from "react";
import { useToast } from "../../hooks/useToast";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { useAppHeader } from "../layout/useAppHeader";
import { usePasswordForm } from "./usePasswordForm";

const PasswordChangeModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();
    const { showSuccess } = useToast();
    const { passwordForm, onSubmitPassword, isSubmittingPassword } = usePasswordForm();

    // Reset form when modal opens
    useEffect(() => {
        if (isModalOpen("password")) {
            passwordForm.reset();
        }
    }, [isModalOpen, passwordForm]);

    const handlePasswordSubmit = passwordForm.handleSubmit(async (data: ChangePasswordRequest) => {
        const success = await onSubmitPassword(data);
        if (success) {
            showSuccess("Password changed successfully");
            closeModal();
        }
    });

    return (
        <IonModal isOpen={isModalOpen("password")} onDidDismiss={closeModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Change Password</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handlePasswordSubmit}>
                    <IonList>
                        <FormPasswordInput
                            name="currentPassword"
                            control={passwordForm.control}
                            label="Current Password"
                            placeholder="Enter current password"
                            disabled={isSubmittingPassword}
                        />

                        <FormPasswordInput
                            name="newPassword"
                            control={passwordForm.control}
                            label="New Password"
                            placeholder="Enter new password"
                            disabled={isSubmittingPassword}
                        />

                        <FormPasswordInput
                            name="confirmPassword"
                            control={passwordForm.control}
                            label="Confirm New Password"
                            placeholder="Re-enter new password"
                            disabled={isSubmittingPassword}
                        />

                        <div className="ion-padding">
                            <IonButton
                                expand="block"
                                type="submit"
                                color="primary"
                                disabled={isSubmittingPassword}
                            >
                                {isSubmittingPassword ? "Updating..." : "Change Password"}
                            </IonButton>
                        </div>
                    </IonList>
                </form>
            </IonContent>
        </IonModal>
    );
};

export default PasswordChangeModal;
