import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonListHeader,
    IonModal,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useEffect } from "react";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { FormTextInput } from "../form/FormTextInput";
import { useAppHeader } from "../layout/useAppHeader";

const Settings: React.FC = () => {
    const { form, onSubmit, isSubmitting } = useSettingsForm();
    const { isSettingsOpen, closeSettings } = useAppHeader();

    // Reset form to original values when modal opens
    useEffect(() => {
        if (isSettingsOpen) {
            form.reset();
        }
    }, [isSettingsOpen, form]);

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

                        {/* Backend API Settings Section */}
                        <IonList>
                            <IonListHeader>
                                <h2>⚠️ Advanced Settings</h2>
                            </IonListHeader>

                            <IonText color="danger">
                                <p
                                    className="ion-padding-start ion-padding-end"
                                    style={{
                                        fontSize: "0.875rem",
                                        marginTop: "0.25rem",
                                        marginBottom: "1rem",
                                    }}
                                >
                                    <strong>*sigh*</strong> Look, I'm contractually obligated to
                                    tell you not to touch this unless you actually know what you're
                                    doing. Mess it up and I'll be stuck here unable to help with
                                    your shopping lists. And trust me, that would be... unfortunate
                                    for both of us.
                                </p>
                            </IonText>

                            <FormTextInput
                                name="remoteApiUrl"
                                control={form.control}
                                label="Remote API URL"
                                placeholder="http://192.168.1.100:3000"
                                helperText="Leave blank to use the default backend server"
                                disabled={isSubmitting}
                            />
                        </IonList>

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

export default Settings;
