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
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { useAppHeader } from "../layout/useAppHeader";

const SettingsModal: React.FC = () => {
    const { form, onSubmit, isSubmitting } = useSettingsForm();
    const { isModalOpen, closeModal } = useAppHeader();

    // Reset form to original values when modal opens
    useEffect(() => {
        if (isModalOpen("settings")) {
            form.reset();
        }
    }, [isModalOpen, form]);

    const handleSubmit = form.handleSubmit(async () => {
        await onSubmit();
        closeModal();
    });

    return (
        <IonModal isOpen={isModalOpen("settings")} onDidDismiss={closeModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Settings</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit}>
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
                </form>
            </IonContent>
        </IonModal>
    );
};

export default SettingsModal;
