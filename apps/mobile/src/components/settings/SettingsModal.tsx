import {
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonLabel,
    IonModal,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
} from "@ionic/react";
import {
    addOutline,
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
import { LLM_ICON_SRC } from "../../llm/shared";
import type { SettingsFormData } from "../../settings/settingsSchema";
import { useSettingsForm } from "../../settings/useSettingsForm";
import { applyTheme } from "../../theme/applyTheme";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";
import { useAppHeader } from "../layout/useAppHeader";
import { ModelTierField } from "./ModelTierField";

import "./SettingsModal.scss";

const FORM_ID = "settings-form";
const MIN_MEALS = 1;
const MAX_MEALS = 12;
const DEFAULT_MEALS = 4;

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
            <ModalHeader title="Settings" onClose={closeModal} />
            <IonContent className="ion-padding">
                <form id={FORM_ID} className="settings" onSubmit={handleFormSubmit}>
                    <section className="settings__section" aria-labelledby="settings-appearance">
                        <h2 id="settings-appearance" className="ruled-label">
                            Appearance
                        </h2>
                        <div className="editor-form">
                            <Controller
                                name="themeMode"
                                control={form.control}
                                render={({ field }) => (
                                    <FormField label="Theme">
                                        <IonSegment
                                            className="editor-mode-switch settings__theme"
                                            aria-label="Theme"
                                            value={field.value ?? "system"}
                                            onIonChange={(e) => {
                                                const newMode = e.detail.value as string;
                                                field.onChange(newMode);
                                                applyTheme(newMode);
                                            }}
                                        >
                                            <IonSegmentButton value="system" layout="icon-start">
                                                <IonIcon
                                                    icon={phonePortraitOutline}
                                                    aria-hidden="true"
                                                />
                                                <IonLabel>System</IonLabel>
                                            </IonSegmentButton>
                                            <IonSegmentButton value="light" layout="icon-start">
                                                <IonIcon icon={sunnyOutline} aria-hidden="true" />
                                                <IonLabel>Light</IonLabel>
                                            </IonSegmentButton>
                                            <IonSegmentButton value="dark" layout="icon-start">
                                                <IonIcon icon={moonOutline} aria-hidden="true" />
                                                <IonLabel>Dark</IonLabel>
                                            </IonSegmentButton>
                                        </IonSegment>
                                    </FormField>
                                )}
                            />
                        </div>
                    </section>

                    <section className="settings__section" aria-labelledby="settings-meals">
                        <h2 id="settings-meals" className="ruled-label">
                            Meal planning
                        </h2>
                        <div className="editor-form">
                            <Controller
                                name="defaultMealPlanSlots"
                                control={form.control}
                                render={({ field, fieldState: { error } }) => {
                                    const count = field.value ?? DEFAULT_MEALS;
                                    return (
                                        <FormField
                                            label="Default meal count"
                                            error={error?.message}
                                        >
                                            <div
                                                className="form-control settings__stepper"
                                                role="group"
                                                aria-label="Default meal count"
                                            >
                                                <button
                                                    type="button"
                                                    className="settings__stepper-btn"
                                                    aria-label="Fewer meals"
                                                    disabled={isSubmitting || count <= MIN_MEALS}
                                                    onClick={() =>
                                                        field.onChange(
                                                            Math.max(MIN_MEALS, count - 1)
                                                        )
                                                    }
                                                >
                                                    <IonIcon
                                                        icon={removeOutline}
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                                <output
                                                    className="settings__stepper-value"
                                                    aria-live="polite"
                                                >
                                                    <span className="settings__stepper-num">
                                                        {count}
                                                    </span>
                                                    <span className="settings__stepper-unit">
                                                        {count === 1 ? "meal" : "meals"}
                                                    </span>
                                                </output>
                                                <button
                                                    type="button"
                                                    className="settings__stepper-btn"
                                                    aria-label="More meals"
                                                    disabled={isSubmitting || count >= MAX_MEALS}
                                                    onClick={() =>
                                                        field.onChange(
                                                            Math.min(MAX_MEALS, count + 1)
                                                        )
                                                    }
                                                >
                                                    <IonIcon icon={addOutline} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </FormField>
                                    );
                                }}
                            />

                            {visibleStores.length > 0 && (
                                <Controller
                                    name="defaultMealPlanStore"
                                    control={form.control}
                                    render={({ field }) => (
                                        <FormField label="Default store">
                                            <div className="form-control">
                                                <IonSelect
                                                    aria-label="Default store"
                                                    value={field.value ?? ""}
                                                    onIonChange={(e) =>
                                                        field.onChange(e.detail.value || undefined)
                                                    }
                                                    interface="action-sheet"
                                                    placeholder="None"
                                                    disabled={isSubmitting}
                                                >
                                                    <IonSelectOption value="">None</IonSelectOption>
                                                    {visibleStores.map((s) => (
                                                        <IonSelectOption key={s.id} value={s.id}>
                                                            {s.name}
                                                        </IonSelectOption>
                                                    ))}
                                                </IonSelect>
                                            </div>
                                        </FormField>
                                    )}
                                />
                            )}
                        </div>
                    </section>

                    <section className="settings__section" aria-labelledby="settings-ai">
                        <h2 id="settings-ai" className="ruled-label">
                            <span className="settings__heading-text">
                                <IonIcon src={LLM_ICON_SRC} aria-hidden="true" />
                                AI provider
                            </span>
                        </h2>
                        <div className="editor-form">
                            <Controller
                                name="llmProviderId"
                                control={form.control}
                                render={({ field }) => (
                                    <FormField label="Provider" hint={selectedProvider.hint}>
                                        <div className="form-control">
                                            <IonSelect
                                                aria-label="Provider"
                                                value={field.value ?? selectedProvider.id}
                                                onIonChange={(e) =>
                                                    handleProviderChange(e.detail.value)
                                                }
                                                interface="action-sheet"
                                                disabled={isSubmitting}
                                            >
                                                {listProviders().map((option) => (
                                                    <IonSelectOption
                                                        key={option.id}
                                                        value={option.id}
                                                    >
                                                        {option.label}
                                                    </IonSelectOption>
                                                ))}
                                            </IonSelect>
                                        </div>
                                    </FormField>
                                )}
                            />

                            {selectedProvider.baseUrlEditable && (
                                <Controller
                                    name="llmBaseUrl"
                                    control={form.control}
                                    render={({ field, fieldState: { error } }) => (
                                        <FormField
                                            label="Base URL"
                                            error={error?.message}
                                            hint="The OpenAI-compatible endpoint, including any /v1 suffix."
                                        >
                                            <div className="form-control">
                                                <IonInput
                                                    aria-label="Base URL"
                                                    type="url"
                                                    inputmode="url"
                                                    autocapitalize="off"
                                                    value={field.value ?? ""}
                                                    placeholder={selectedProvider.defaultBaseUrl}
                                                    disabled={isSubmitting}
                                                    onIonInput={(e) =>
                                                        field.onChange(e.detail.value?.trim() ?? "")
                                                    }
                                                    onIonBlur={field.onBlur}
                                                />
                                            </div>
                                        </FormField>
                                    )}
                                />
                            )}

                            {selectedProvider.requiresApiKey && (
                                <Controller
                                    name="llmApiKey"
                                    control={form.control}
                                    render={({ field, fieldState: { error } }) => (
                                        <FormField
                                            label={`${selectedProvider.label} API key`}
                                            error={error?.message}
                                            hint="Required for AI features. Kept in this device's secure storage."
                                        >
                                            <div className="form-control">
                                                <IonInput
                                                    aria-label={`${selectedProvider.label} API key`}
                                                    type="password"
                                                    autocapitalize="off"
                                                    value={field.value ?? ""}
                                                    placeholder={selectedProvider.apiKeyPlaceholder}
                                                    disabled={isSubmitting}
                                                    onIonInput={(e) =>
                                                        field.onChange(e.detail.value?.trim() ?? "")
                                                    }
                                                    onIonBlur={field.onBlur}
                                                >
                                                    <IonInputPasswordToggle
                                                        slot="end"
                                                        color="medium"
                                                    />
                                                </IonInput>
                                            </div>
                                        </FormField>
                                    )}
                                />
                            )}
                        </div>
                    </section>

                    <section className="settings__section" aria-labelledby="settings-models">
                        <h2 id="settings-models" className="ruled-label">
                            Models
                        </h2>
                        <div className="editor-form">
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
                        </div>
                    </section>
                </form>
            </IonContent>

            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    type="submit"
                    form={FORM_ID}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <IonSpinner name="dots" /> : "Save settings"}
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

export default SettingsModal;
