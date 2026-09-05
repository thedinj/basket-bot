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
import { LLM_TIERS } from "@basket-bot/core";
import { configForProvider } from "../../llm/config/llmConfig";
import { MODEL_FIELDS } from "../../settings/llmSettings";
import { getProviderOrDefault, listProviders } from "../../llm/providers/registry";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared";
import type { SettingsFormData } from "../../settings/settingsSchema";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { applyTheme } from "../../theme/applyTheme";
import { FormPasswordInput } from "../form/FormPasswordInput";
import { FormTextInput } from "../form/FormTextInput";
import { useAppHeader } from "../layout/useAppHeader";
import { ModelTierField } from "./ModelTierField";

const SettingsModal: React.FC = () => {
    const { form, performSave, isSubmitting, catalog, isCatalogLoading } = useSettingsForm();
    const { isModalOpen, closeModal } = useAppHeader();
    const visibleStores = useVisibleStores();

    // Descriptor for whatever provider the form currently shows, so the labels,
    // placeholder, and base-URL visibility follow the picker without a save.
    const selectedProviderId = form.watch("llmProviderId");
    const selectedProvider = getProviderOrDefault(selectedProviderId ?? "");

    /**
     * Switching provider drops every override back to that provider's defaults. A model name
     * is provider-specific, so carrying one across would leave a setting that cannot work.
     */
    const handleProviderChange = (providerId: string) => {
        const seeded = configForProvider(providerId);
        form.setValue("llmProviderId", seeded.providerId);
        form.setValue("llmBaseUrl", seeded.baseUrl ?? undefined);
        form.setValue("llmApiKey", undefined);
        for (const tier of LLM_TIERS) {
            form.setValue(MODEL_FIELDS[tier].value, undefined);
            form.setValue(MODEL_FIELDS[tier].useDefault, true);
        }
    };

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

                        <Controller
                            name="llmProviderId"
                            control={form.control}
                            render={({ field }) => (
                                <IonItem>
                                    <IonLabel>Provider</IonLabel>
                                    <IonSelect
                                        value={field.value ?? selectedProvider.id}
                                        onIonChange={(e) => handleProviderChange(e.detail.value)}
                                        interface="action-sheet"
                                        disabled={isSubmitting}
                                    >
                                        {listProviders().map((option) => (
                                            <IonSelectOption key={option.id} value={option.id}>
                                                {option.label}
                                            </IonSelectOption>
                                        ))}
                                    </IonSelect>
                                </IonItem>
                            )}
                        />
                        <IonItem lines="none">
                            <IonNote>{selectedProvider.hint}</IonNote>
                        </IonItem>

                        {selectedProvider.baseUrlEditable && (
                            <FormTextInput
                                name="llmBaseUrl"
                                control={form.control}
                                label="Base URL"
                                placeholder={selectedProvider.defaultBaseUrl}
                                helperText="The OpenAI-compatible endpoint, including any /v1 suffix"
                                disabled={isSubmitting}
                            />
                        )}

                        {selectedProvider.requiresApiKey && (
                            <FormPasswordInput
                                name="llmApiKey"
                                control={form.control}
                                label={`${selectedProvider.label} API Key`}
                                placeholder={selectedProvider.apiKeyPlaceholder}
                                helperText={`Enter your ${selectedProvider.label} API key for AI-powered features`}
                                disabled={isSubmitting}
                            />
                        )}

                        {LLM_TIERS.map((tier) => (
                            <ModelTierField
                                key={tier}
                                tier={tier}
                                control={form.control}
                                setValue={form.setValue}
                                providerId={selectedProvider.id}
                                catalog={catalog}
                                isCatalogLoading={isCatalogLoading}
                                disabled={isSubmitting}
                            />
                        ))}

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
