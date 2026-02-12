import { useProfileForm } from "@/components/settings/useProfileForm";
import { type UpdateProfileRequest } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useEffect } from "react";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { FormTextInput } from "../form/FormTextInput";
import { useAppHeader } from "../layout/useAppHeader";

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
        const success = await onSubmitProfile(data);
        if (success) {
            showSuccess("Profile updated successfully");
        }
    });

    return (
        <IonModal isOpen={isModalOpen("profile")} onDidDismiss={closeModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Edit Profile</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleProfileSubmit}>
                    <IonList>
                        <IonListHeader>
                            <h2>Basic Information</h2>
                        </IonListHeader>

                        {/* Email (read-only) */}
                        <IonItem>
                            <IonLabel position="stacked">Email</IonLabel>
                            <IonInput value={user?.email} disabled={true} />
                        </IonItem>
                        <IonText color="medium">
                            <p
                                className="ion-padding-start ion-padding-end"
                                style={{
                                    fontSize: "0.875rem",
                                    marginTop: "0.25rem",
                                }}
                            >
                                Email address cannot be changed
                            </p>
                        </IonText>

                        {/* Name (editable) */}
                        <FormTextInput
                            name="name"
                            control={profileForm.control}
                            label="Name"
                            placeholder="Your name"
                            disabled={isSubmittingProfile}
                        />

                        <div className="ion-padding">
                            <IonButton expand="block" type="submit" disabled={isSubmittingProfile}>
                                {isSubmittingProfile ? "Saving..." : "Save Profile"}
                            </IonButton>
                        </div>
                    </IonList>
                </form>
            </IonContent>
        </IonModal>
    );
};

export default ProfileEditorModal;
