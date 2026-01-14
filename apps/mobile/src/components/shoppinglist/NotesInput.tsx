import { IonInput, IonItem, IonLabel } from "@ionic/react";
import { Controller, useWatch } from "react-hook-form";
import { useItemEditorContext } from "./useItemEditorContext";

export const NotesInput = () => {
    const { control } = useItemEditorContext();
    const isIdea = useWatch({ control, name: "isIdea" });

    return (
        <Controller
            name="notes"
            control={control}
            render={({ field }) => (
                <IonItem>
                    <IonLabel position="stacked">
                        {isIdea ? "Idea" : "Notes"}
                    </IonLabel>
                    <IonInput
                        value={field.value || ""}
                        placeholder={
                            isIdea ? "Enter your idea" : "Enter any notes"
                        }
                        onIonInput={(e) =>
                            field.onChange(e.detail.value || null)
                        }
                    />
                </IonItem>
            )}
        />
    );
};
