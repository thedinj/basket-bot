import { IonIcon, IonInput } from "@ionic/react";
import { eyeOffOutline, eyeOutline } from "ionicons/icons";
import { useState } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { FormField } from "../shared/FormField";

type PasswordFieldProps<T extends FieldValues> = {
    name: Path<T>;
    control: Control<T>;
    label: string;
    placeholder?: string;
    hint?: string;
    autocomplete?: "current-password" | "new-password";
    disabled?: boolean;
};

/**
 * A password on the form system: a field box with a show/hide glyph on its trailing inset, bound
 * to react-hook-form. Passwords never carry leading or trailing whitespace, so input is trimmed.
 */
export const PasswordField = <T extends FieldValues>({
    name,
    control,
    label,
    placeholder,
    hint,
    autocomplete = "current-password",
    disabled = false,
}: PasswordFieldProps<T>) => {
    const [visible, setVisible] = useState(false);

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <FormField label={label} error={error?.message} hint={hint}>
                    <div className="form-control">
                        <IonInput
                            aria-label={label}
                            type={visible ? "text" : "password"}
                            value={field.value}
                            placeholder={placeholder}
                            autocomplete={autocomplete}
                            disabled={disabled}
                            onIonInput={(e) => field.onChange(e.detail.value?.trim() ?? "")}
                            onIonBlur={field.onBlur}
                        />
                        <button
                            type="button"
                            className="form-control__icon-button form-control__icon-button--end"
                            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
                            aria-pressed={visible}
                            disabled={disabled}
                            onClick={() => setVisible((v) => !v)}
                        >
                            <IonIcon
                                icon={visible ? eyeOffOutline : eyeOutline}
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </FormField>
            )}
        />
    );
};
