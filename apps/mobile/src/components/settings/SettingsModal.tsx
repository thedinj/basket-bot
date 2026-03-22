import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline, moonOutline, phonePortraitOutline, sunnyOutline } from "ionicons/icons";
import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import type { SettingsFormData } from "../../settings/settingsSchema";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { applyTheme } from "../../theme/applyTheme";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { useAppHeader } from "../layout/useAppHeader";

const SettingsModal: React.FC = () => {
    const { form, performSave, isSubmitting } = useSettingsForm();
    const { isModalOpen, closeModal } = useAppHeader();

    const preOpenModeRef = useRef<string | null>(null);
    const saveSucceededRef = useRef(false);

    // Capture pre-open theme and reset form when modal opens
    useEffect(() => {
        if (isModalOpen("settings")) {
            saveSucceededRef.current = false;
            form.reset();
            // After reset, form values reflect stored preferences
            preOpenModeRef.current = form.getValues("themeMode") ?? null;
        }
    }, [isModalOpen, form]);

    const handleFormSubmit = form.handleSubmit(async (data: SettingsFormData) => {
        const succeeded = await performSave(data);
        if (succeeded) {
            saveSucceededRef.current = true;
            closeModal();
        }
    });

    // On any dismiss (X button, backdrop, programmatic): revert live preview if not saved
    const handleDismiss = () => {
        if (!saveSucceededRef.current) {
            applyTheme(preOpenModeRef.current);
        }
        saveSucceededRef.current = false;
        closeModal();
    };

    return (
        <IonModal isOpen={isModalOpen("settings")} onDidDismiss={handleDismiss}>
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
                <form onSubmit={handleFormSubmit}>
                    {/* Appearance Section */}
                    <IonList>
                        <IonListHeader>
                            <h2>Appearance</h2>
                        </IonListHeader>

                        <div className="ion-padding-horizontal ion-padding-bottom">
                            <Controller
                                name="themeMode"
                                control={form.control}
                                render={({ field }) => (
                                    <IonSegment
                                        value={field.value ?? "system"}
                                        onIonChange={(e) => {
                                            const newMode = e.detail.value as string;
                                            field.onChange(newMode);
                                            applyTheme(newMode);
                                        }}
                                    >
                                        <IonSegmentButton value="system">
                                            <IonIcon icon={phonePortraitOutline} />
                                            <IonLabel>System</IonLabel>
                                        </IonSegmentButton>
                                        <IonSegmentButton value="light">
                                            <IonIcon icon={sunnyOutline} />
                                            <IonLabel>Light</IonLabel>
                                        </IonSegmentButton>
                                        <IonSegmentButton value="dark">
                                            <IonIcon icon={moonOutline} />
                                            <IonLabel>Dark</IonLabel>
                                        </IonSegmentButton>
                                    </IonSegment>
                                )}
                            />
                        </div>
                    </IonList>

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
