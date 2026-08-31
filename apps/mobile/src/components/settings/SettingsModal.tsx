import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import {
    addOutline,
    closeOutline,
    moonOutline,
    phonePortraitOutline,
    removeOutline,
    sunnyOutline,
} from "ionicons/icons";
import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import { useVisibleStores } from "../../db/hooks";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import type { SettingsFormData } from "../../settings/settingsSchema";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { applyTheme } from "../../theme/applyTheme";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { useAppHeader } from "../layout/useAppHeader";
import AboutSection from "./AboutSection";

const SettingsModal: React.FC = () => {
    const { form, performSave, isSubmitting } = useSettingsForm();
    const { isModalOpen, closeModal } = useAppHeader();
    const visibleStores = useVisibleStores();

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

                    {/* Meal Planning Section */}
                    <IonList>
                        <IonListHeader>
                            <h2>Meal Planning</h2>
                        </IonListHeader>

                        <Controller
                            name="defaultMealPlanSlots"
                            control={form.control}
                            render={({ field, fieldState: { error } }) => (
                                <IonItem>
                                    <IonLabel>Default meal count</IonLabel>
                                    <div
                                        slot="end"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                        }}
                                    >
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            disabled={isSubmitting || (field.value ?? 4) <= 1}
                                            onClick={() =>
                                                field.onChange(Math.max(1, (field.value ?? 4) - 1))
                                            }
                                        >
                                            <IonIcon icon={removeOutline} slot="icon-only" />
                                        </IonButton>
                                        <IonNote
                                            style={{
                                                minWidth: "24px",
                                                textAlign: "center",
                                                fontSize: "1.1rem",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {field.value ?? 4}
                                        </IonNote>
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            disabled={isSubmitting || (field.value ?? 4) >= 12}
                                            onClick={() =>
                                                field.onChange(Math.min(12, (field.value ?? 4) + 1))
                                            }
                                        >
                                            <IonIcon icon={addOutline} slot="icon-only" />
                                        </IonButton>
                                    </div>
                                    {error && (
                                        <IonNote color="danger" slot="helper">
                                            {error.message}
                                        </IonNote>
                                    )}
                                </IonItem>
                            )}
                        />
                        {visibleStores.length > 0 && (
                            <Controller
                                name="defaultMealPlanStore"
                                control={form.control}
                                render={({ field }) => (
                                    <IonItem>
                                        <IonLabel>Default store</IonLabel>
                                        <IonSelect
                                            value={field.value ?? ""}
                                            onIonChange={(e) =>
                                                field.onChange(e.detail.value || undefined)
                                            }
                                            interface="action-sheet"
                                            placeholder="Select a store"
                                            disabled={isSubmitting}
                                        >
                                            <IonSelectOption value="">(none)</IonSelectOption>
                                            {visibleStores.map((s) => (
                                                <IonSelectOption key={s.id} value={s.id}>
                                                    {s.name}
                                                </IonSelectOption>
                                            ))}
                                        </IonSelect>
                                    </IonItem>
                                )}
                            />
                        )}
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

                <AboutSection />
            </IonContent>
        </IonModal>
    );
};

export default SettingsModal;
