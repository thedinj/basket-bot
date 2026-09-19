import { IonInput } from "@ionic/react";
import { ComponentProps } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { FormField } from "../shared/FormField";

type TextFieldProps<T extends FieldValues> = {
    name: Path<T>;
    control: Control<T>;
    label: string;
    placeholder?: string;
    hint?: string;
    type?: "text" | "email" | "url" | "tel";
    autocomplete?: ComponentProps<typeof IonInput>["autocomplete"];
    /** "words" for names, "sentences" for free text; off by default (emails, codes). */
    autocapitalize?: "off" | "words" | "sentences";
    disabled?: boolean;
};

/**
 * A text input on the form system (label, 48px box, hint, error), bound to react-hook-form. Use
 * it for plain fields in a form; screens with extra controls in the box build their own from
 * FormField + .form-control.
 */
export const TextField = <T extends FieldValues>({
    name,
    control,
    label,
    placeholder,
    hint,
    type = "text",
    autocomplete,
    autocapitalize = "off",
    disabled = false,
}: TextFieldProps<T>) => (
    <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
            <FormField label={label} error={error?.message} hint={hint}>
                <div className="form-control">
                    <IonInput
                        aria-label={label}
                        type={type}
                        value={field.value}
                        placeholder={placeholder}
                        autocomplete={autocomplete}
                        autocapitalize={autocapitalize}
                        disabled={disabled}
                        onIonInput={(e) => field.onChange(e.detail.value ?? "")}
                        onIonBlur={field.onBlur}
                    />
                </div>
            </FormField>
        )}
    />
);
