import { IonInput, IonItem, IonLabel, IonText } from "@ionic/react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";

interface FormTextInputProps<T extends FieldValues> {
    name: Path<T>;
    control: Control<T>;
    label: string;
    type?: "text" | "email";
    placeholder?: string;
    helperText?: string;
    disabled?: boolean;
}

/**
 * Reusable text/email input component
 * Integrates Ionic's IonInput with React Hook Form
 */
export function FormTextInput<T extends FieldValues>({
    name,
    control,
    label,
    type = "text",
    placeholder,
    helperText,
    disabled = false,
}: FormTextInputProps<T>) {
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
                            type={type}
                            placeholder={placeholder}
                            disabled={disabled}
                            onIonInput={(e) => {
                                // Trim whitespace
                                const value = e.detail.value?.trim() ?? "";
                                field.onChange(value);
                            }}
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
