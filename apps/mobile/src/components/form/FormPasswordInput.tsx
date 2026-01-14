import { IonIcon, IonInput, IonItem, IonLabel, IonText } from "@ionic/react";
import { eye, eyeOff } from "ionicons/icons";
import { useState } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";

interface FormPasswordInputProps<T extends FieldValues> {
    name: Path<T>;
    control: Control<T>;
    label: string;
    placeholder?: string;
    helperText?: string;
    disabled?: boolean;
}

/**
 * Reusable password input component with show/hide toggle
 * Integrates Ionic's IonInput with React Hook Form
 */
export function FormPasswordInput<T extends FieldValues>({
    name,
    control,
    label,
    placeholder,
    helperText,
    disabled = false,
}: FormPasswordInputProps<T>) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <>
                    <IonItem>
                        <IonLabel position="stacked">{label}</IonLabel>
                        <IonInput
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder={placeholder}
                            disabled={disabled}
                            onIonInput={(e) => {
                                // Trim whitespace from password fields
                                const value = e.detail.value?.trim() ?? "";
                                field.onChange(value);
                            }}
                        />
                        <IonIcon
                            slot="end"
                            icon={showPassword ? eyeOff : eye}
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ cursor: "pointer", marginTop: "1.5rem" }}
                        />
                    </IonItem>
                    {helperText && !error && (
                        <IonText color="medium">
                            <p
                                className="ion-padding-start ion-padding-end"
                                style={{
                                    fontSize: "0.875rem",
                                    marginTop: "0.25rem",
                                }}
                            >
                                {helperText}
                            </p>
                        </IonText>
                    )}
                    {error && (
                        <IonText color="danger">
                            <p
                                className="ion-padding-start ion-padding-end"
                                style={{
                                    fontSize: "0.875rem",
                                    marginTop: "0.25rem",
                                }}
                            >
                                {error.message}
                            </p>
                        </IonText>
                    )}
                </>
            )}
        />
    );
}
