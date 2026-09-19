import { useProfileForm } from "@/components/settings/useProfileForm";
import { type UpdateProfileRequest } from "@basket-bot/core";
import { IonButton, IonContent, IonIcon, IonModal } from "@ionic/react";
import { lockClosedOutline } from "ionicons/icons";
import { useEffect } from "react";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { TextField } from "../form/TextField";
import { useAppHeader } from "../layout/useAppHeader";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";

const PROFILE_FORM_ID = "profile-editor-form";

const ProfileEditorModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();
    const { user } = useAuth();
    const { showSuccess } = useToast();
    const { profileForm, onSubmitProfile, isSubmittingProfile } = useProfileForm();

    // Reset form when modal opens
    useEffect(() => {
        if (isModalOpen("profile")) {
            profileForm.reset();
        }
    }, [isModalOpen, profileForm]);

    const handleProfileSubmit = profileForm.handleSubmit(async (data: UpdateProfileRequest) => {
        const success = await onSubmitProfile({ ...data, name: data.name.trim() });
        if (success) {
            showSuccess("Profile updated successfully");
        }
    });

    return (
        <IonModal isOpen={isModalOpen("profile")} onDidDismiss={closeModal}>
            <ModalHeader title="Edit Profile" onClose={closeModal} />
            <IonContent className="ion-padding">
                <form
                    id={PROFILE_FORM_ID}
                    className="editor-form"
                    onSubmit={handleProfileSubmit}
                    noValidate
                >
                    <TextField
                        name="name"
                        control={profileForm.control}
                        label="Name"
                        placeholder="Your name"
                        autocapitalize="words"
                        autocomplete="name"
                        disabled={isSubmittingProfile}
                    />

                    <FormField label="Email" hint="Email address cannot be changed.">
                        <div className="form-control form-control--readonly">
                            <span className="form-control__value">{user?.email}</span>
                            <IonIcon
                                className="form-control__trail"
                                icon={lockClosedOutline}
                                aria-hidden="true"
                            />
                        </div>
                    </FormField>
                </form>
            </IonContent>
            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    type="submit"
                    form={PROFILE_FORM_ID}
                    disabled={isSubmittingProfile}
                >
                    {isSubmittingProfile ? "Saving..." : "Save Profile"}
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

export default ProfileEditorModal;
