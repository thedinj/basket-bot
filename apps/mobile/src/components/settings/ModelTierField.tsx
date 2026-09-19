import type { LLMCatalog, LLMTier } from "@basket-bot/core";
import { IonSkeletonText, IonToggle } from "@ionic/react";
import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { modelsForTier, resolveProviderCatalog } from "../../llm/config/llmCatalog";
import { LLM_TIER_META } from "../../llm/config/tierMeta";
import { MODEL_FIELDS } from "../../settings/llmSettings";
import type { SettingsFormData } from "../../settings/settingsSchema";
import { FormModelSelect } from "../form/FormModelSelect";
import { FormField } from "../shared/FormField";

interface ModelTierFieldProps {
    tier: LLMTier;
    control: Control<SettingsFormData>;
    setValue: UseFormSetValue<SettingsFormData>;
    /** The provider currently selected in the form, which may not be the saved one yet. */
    providerId: string;
    catalog: LLMCatalog | null;
    isCatalogLoading: boolean;
    disabled: boolean;
}

/**
 * One tier's model setting: a "use the default" switch, and a picker when it is off.
 *
 * The switch is the whole point of the screen. "Use the default" is not a convenience for
 * the user so much as a promise to them: leaving it on stores *nothing*, so the tier keeps
 * following whatever model the server currently recommends, including one chosen after this
 * app was installed. Turning it off is the deliberate act of pinning a name.
 *
 * Laid out as one form field: the tier's label, a boxed toggle whose label is its state (the
 * default it follows, or "Custom"), the picker under it when custom, and what the tier is for.
 */
export const ModelTierField: React.FC<ModelTierFieldProps> = ({
    tier,
    control,
    setValue,
    providerId,
    catalog,
    isCatalogLoading,
    disabled,
}) => {
    const meta = LLM_TIER_META[tier];
    const fields = MODEL_FIELDS[tier];
    const resolved = resolveProviderCatalog(providerId, catalog);
    const defaultModel = resolved.defaultModels[tier];
    const options = modelsForTier(resolved, tier).map((model) => ({
        value: model.id,
        label: model.label,
    }));

    // Naming the bundled fallback and then silently swapping it for the server's would read
    // as the screen changing its mind about what the default is, so wait instead.
    if (isCatalogLoading) {
        return (
            <FormField label={meta.label} hint={meta.helperText}>
                <div className="form-control" aria-busy="true">
                    <IonSkeletonText animated className="settings__skeleton" />
                </div>
            </FormField>
        );
    }

    return (
        <Controller
            name={fields.useDefault}
            control={control}
            render={({ field }) => {
                const useDefault = field.value !== false;

                return (
                    <FormField label={meta.label} hint={meta.helperText}>
                        <div className="form-control">
                            <IonToggle
                                labelPlacement="start"
                                justify="space-between"
                                aria-label={`${meta.label}: use default`}
                                checked={useDefault}
                                disabled={disabled}
                                onIonChange={(e) => {
                                    const next = e.detail.checked;
                                    field.onChange(next);
                                    // Turning the override on starts from the current default
                                    // rather than a blank field, so the picker opens on a real
                                    // choice. Turning it back off leaves the value in form
                                    // state — the save plan ignores it, and toggling twice
                                    // shouldn't throw away what was typed.
                                    if (!next) {
                                        setValue(fields.value, defaultModel);
                                    }
                                }}
                            >
                                {/* A fixed label for what "on" means; the default's name
                                    rides along so it's visible either way. */}
                                <span className="settings__toggle-label">
                                    Use default
                                    <span className="settings__toggle-model">{defaultModel}</span>
                                </span>
                            </IonToggle>
                        </div>

                        {!useDefault && (
                            <FormModelSelect
                                name={fields.value}
                                control={control}
                                label={meta.label}
                                options={options}
                                placeholder={defaultModel}
                                disabled={disabled}
                            />
                        )}
                    </FormField>
                );
            }}
        />
    );
};
