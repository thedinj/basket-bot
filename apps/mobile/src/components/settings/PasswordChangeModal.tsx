import { type ChangePasswordRequest } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonListHeader,
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
    const { isPasswordOpen, closePassword } = useAppHeader();
    const { showSuccess } = useToast();
    const { passwordForm, onSubmitPassword, isSubmittingPassword } = usePasswordForm();

    // Reset form when modal opens
    useEffect(() => {
        if (isPasswordOpen) {
            passwordForm.reset();
        }
    }, [isPasswordOpen, passwordForm]);

    const handlePasswordSubmit = passwordForm.handleSubmit(async (data: ChangePasswordRequest) => {
        const success = await onSubmitPassword(data);
        if (success) {
            showSuccess("Password changed successfully");
            closePassword();
        }
    });

    return (
        <IonModal isOpen={isPasswordOpen} onDidDismiss={closePassword}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Change Password</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closePassword}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handlePasswordSubmit}>
                    <IonList>
                        <IonListHeader>
                            <h2>Update Your Password</h2>
                        </IonListHeader>

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
                                {isSubmittingPassword ? "Updating..." : "Update Password"}
                            </IonButton>
                        </div>
                    </IonList>
                </form>
            </IonContent>
        </IonModal>
    );
};

export default PasswordChangeModal;
