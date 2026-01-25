import {
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonNote,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { onlineManager } from "@tanstack/react-query";
import { closeOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { FormTextInput } from "../form/FormTextInput";
import { useAppHeader } from "../layout/useAppHeader";

const Settings: React.FC = () => {
    const { form, onSubmit, isSubmitting } = useSettingsForm();
    const { isSettingsOpen, closeSettings } = useAppHeader();
    const [simulateOffline, setSimulateOffline] = useState(false);

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

    const handleOfflineToggle = (checked: boolean) => {
        setSimulateOffline(checked);
        // Toggle TanStack Query's online status
        onlineManager.setOnline(!checked);
    };

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

                        {/* Developer Options Section */}
                        <IonList>
                            <IonListHeader>
                                <h2>🛠️ Developer Options</h2>
                            </IonListHeader>

                            <FormTextInput
                                name="remoteApiUrl"
                                control={form.control}
                                label="Remote API URL"
                                placeholder="http://192.168.1.100:3000"
                                helperText="Leave blank to use the default backend server"
                                disabled={isSubmitting}
                            />

                            <IonItem>
                                <IonLabel>
                                    <h3>Simulate Offline Mode</h3>
                                    <IonNote>
                                        Test network resilience features without disconnecting
                                    </IonNote>
                                </IonLabel>
                                <IonCheckbox
                                    slot="end"
                                    checked={simulateOffline}
                                    onIonChange={(e) => handleOfflineToggle(e.detail.checked)}
                                />
                            </IonItem>
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
