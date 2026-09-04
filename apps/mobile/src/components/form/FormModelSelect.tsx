import { IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonText } from "@ionic/react";
import { useState } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";

/** The sentinel `IonSelect` value meaning "let me type one". Not a valid model id. */
const CUSTOM_VALUE = "__custom__";

export interface ModelSelectOption {
    value: string;
    label: string;
}

interface FormModelSelectProps<T extends FieldValues> {
    name: Path<T>;
    control: Control<T>;
    label: string;
    options: readonly ModelSelectOption[];
    placeholder?: string;
    helperText?: string;
    disabled?: boolean;
    /** Wording for the escape-hatch entry. */
    customLabel?: string;
}

/**
 * "Pick one of these, or type your own" — a select over known values with a free-text
 * fallback, bound to react-hook-form.
 *
 * Knows nothing about LLMs or providers: it takes options, so it sits alongside
 * `FormTextInput` / `FormPasswordInput` as a generic control. That matters here because the
 * options come from a server-served catalogue that will list models this build has never
 * heard of, and users point the app at private servers running models no catalogue lists —
 * so a closed dropdown would be wrong, and a bare text field would make everyone type an
 * exact model id from memory.
 *
 * The field value stays a plain string, so callers treat it exactly like a text input; the
 * custom/listed distinction is presentation only and never reaches storage.
 */
export function FormModelSelect<T extends FieldValues>({
    name,
    control,
    label,
    options,
    placeholder,
    helperText,
    disabled = false,
    customLabel = "Custom…",
}: FormModelSelectProps<T>) {
    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <FormModelSelectField
                    label={label}
                    options={options}
                    placeholder={placeholder}
                    helperText={helperText}
                    disabled={disabled}
                    customLabel={customLabel}
                    value={(field.value as string | undefined) ?? ""}
                    onChange={field.onChange}
                    errorMessage={error?.message}
                />
            )}
        />
    );
}

interface FieldProps {
    label: string;
    options: readonly ModelSelectOption[];
    placeholder?: string;
    helperText?: string;
    disabled: boolean;
    customLabel: string;
    value: string;
    onChange: (value: string) => void;
    errorMessage?: string;
}

/**
 * Split out so the custom-mode flag can live in component state without a hook running
 * inside `Controller`'s render prop.
 */
const FormModelSelectField: React.FC<FieldProps> = ({
    label,
    options,
    placeholder,
    helperText,
    disabled,
    customLabel,
    value,
    onChange,
    errorMessage,
}) => {
    const isListed = options.some((option) => option.value === value);

    // Seeded, not derived on every render: a value the options don't contain means the user
    // typed it (or it is a model since retired from the catalogue), so open in custom mode —
    // but once they choose `Custom…` and the field is empty, "not listed" is no longer
    // enough to keep it open, and recomputing would snap it shut under them.
    const [isCustom, setIsCustom] = useState(() => value !== "" && !isListed);

    const showSelect = options.length > 0;
    const showInput = !showSelect || isCustom;

    const handleSelect = (selected: string) => {
        if (selected === CUSTOM_VALUE) {
            setIsCustom(true);
            return;
        }
        setIsCustom(false);
        onChange(selected);
    };

    return (
        <>
            {showSelect && (
                <IonItem>
                    <IonLabel position="stacked">{label}</IonLabel>
                    <IonSelect
                        value={isCustom || !isListed ? CUSTOM_VALUE : value}
                        placeholder={placeholder}
                        onIonChange={(e) => handleSelect(e.detail.value as string)}
                        interface="action-sheet"
                        disabled={disabled}
                    >
                        {options.map((option) => (
                            <IonSelectOption key={option.value} value={option.value}>
                                {option.label}
                            </IonSelectOption>
                        ))}
                        <IonSelectOption value={CUSTOM_VALUE}>{customLabel}</IonSelectOption>
                    </IonSelect>
                </IonItem>
            )}

            {showInput && (
                <IonItem>
                    <IonLabel position="stacked">{showSelect ? "Model name" : label}</IonLabel>
                    <IonInput
                        value={value}
                        type="text"
                        placeholder={placeholder}
                        disabled={disabled}
                        onIonInput={(e) => onChange(e.detail.value?.trim() ?? "")}
                    />
                </IonItem>
            )}

            {helperText && !errorMessage && (
                <IonText color="medium">
                    <p
                        className="ion-padding-start ion-padding-end"
                        style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}
                    >
                        {helperText}
                    </p>
                </IonText>
            )}
            {errorMessage && (
                <IonText color="danger">
                    <p
                        className="ion-padding-start ion-padding-end"
                        style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}
                    >
                        {errorMessage}
                    </p>
                </IonText>
            )}
        </>
    );
};
