import type { LLMCatalog, LLMTier } from "@basket-bot/core";
import { IonItem, IonLabel, IonNote, IonToggle } from "@ionic/react";
import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { modelsForTier, resolveProviderCatalog } from "../../llm/config/llmCatalog";
import { LLM_TIER_META } from "../../llm/config/tierMeta";
import { MODEL_FIELDS } from "../../settings/llmSettings";
import type { SettingsFormData } from "../../settings/settingsSchema";
import { FormModelSelect } from "../form/FormModelSelect";
import { SkeletonListItem } from "../shared/skeleton/SkeletonListItem";

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
        return <SkeletonListItem widths={["35%", "55%"]} />;
    }

    return (
        <Controller
            name={fields.useDefault}
            control={control}
            render={({ field }) => {
                const useDefault = field.value !== false;

                return (
                    <>
                        <IonItem>
                            <IonLabel>
                                <h3>{meta.label}</h3>
                                <p>{meta.helperText}</p>
                            </IonLabel>
                            <IonToggle
                                slot="end"
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
                                Use default
                            </IonToggle>
                        </IonItem>

                        {useDefault ? (
                            <IonItem lines="none">
                                <IonNote>Default: {defaultModel}</IonNote>
                            </IonItem>
                        ) : (
                            <FormModelSelect
                                name={fields.value}
                                control={control}
                                label={meta.label}
                                options={options}
                                placeholder={defaultModel}
                                disabled={disabled}
                            />
                        )}
                    </>
                );
            }}
        />
    );
};
