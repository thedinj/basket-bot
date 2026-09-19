import { type ChangePasswordRequest } from "@basket-bot/core";
import { IonButton, IonContent, IonModal } from "@ionic/react";
import { useEffect } from "react";
import { useToast } from "../../hooks/useToast";
import { PasswordField } from "../form/PasswordField";
import { useAppHeader } from "../layout/useAppHeader";
import { EditorFooter } from "../shared/EditorFooter";
import { ModalHeader } from "../shared/ModalHeader";
import { usePasswordForm } from "./usePasswordForm";

const PASSWORD_FORM_ID = "password-change-form";

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
            <ModalHeader title="Change Password" onClose={closeModal} />
            <IonContent className="ion-padding">
                <form
                    id={PASSWORD_FORM_ID}
                    className="editor-form"
                    onSubmit={handlePasswordSubmit}
                    noValidate
                >
                    <PasswordField
                        name="currentPassword"
                        control={passwordForm.control}
                        label="Current Password"
                        placeholder="Enter current password"
                        autocomplete="current-password"
                        disabled={isSubmittingPassword}
                    />

                    <PasswordField
                        name="newPassword"
                        control={passwordForm.control}
                        label="New Password"
                        placeholder="Enter new password"
                        autocomplete="new-password"
                        disabled={isSubmittingPassword}
                    />

                    <PasswordField
                        name="confirmPassword"
                        control={passwordForm.control}
                        label="Confirm New Password"
                        placeholder="Re-enter new password"
                        autocomplete="new-password"
                        disabled={isSubmittingPassword}
                    />
                </form>
            </IonContent>
            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    type="submit"
                    form={PASSWORD_FORM_ID}
                    disabled={isSubmittingPassword}
                >
                    {isSubmittingPassword ? "Updating..." : "Change Password"}
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

export default PasswordChangeModal;
