import { IonTextarea } from "@ionic/react";
import { Controller, useWatch } from "react-hook-form";
import { FormField } from "../shared/FormField";
import { useItemEditorContext } from "./useItemEditorContext";

export const NotesInput = () => {
    const { control, errors } = useItemEditorContext();
    const isIdea = useWatch({ control, name: "isIdea" });
    const label = isIdea ? "Idea" : "Notes";

    return (
        <Controller
            name="notes"
            control={control}
            render={({ field }) => (
                <FormField label={label} error={errors.notes?.message}>
                    <div className="form-control">
                        <IonTextarea
                            aria-label={label}
                            value={field.value || ""}
                            autocapitalize="sentences"
                            autoGrow
                            rows={1}
                            placeholder={isIdea ? "Enter your idea" : "Enter notes"}
                            onIonInput={(e) => field.onChange(e.detail.value || null)}
                        />
                    </div>
                </FormField>
            )}
        />
    );
};
