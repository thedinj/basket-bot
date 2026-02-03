import { IonInput, IonItem, IonLabel, IonText } from "@ionic/react";
import { Controller, useWatch } from "react-hook-form";
import { useItemEditorContext } from "./useItemEditorContext";

export const NotesInput = () => {
    const { control, errors } = useItemEditorContext();
    const isIdea = useWatch({ control, name: "isIdea" });

    return (
        <Controller
            name="notes"
            control={control}
            render={({ field }) => (
                <IonItem>
                    <IonLabel position="stacked">{isIdea ? "Idea" : "Notes"}</IonLabel>
                    <IonInput
                        value={field.value || ""}
                        autocapitalize="sentences"
                        placeholder={isIdea ? "Enter your idea" : "Enter any notes"}
                        onIonInput={(e) => field.onChange(e.detail.value || null)}
                    />
                    {errors.notes && (
                        <IonText color="danger">
                            <p
                                style={{
                                    fontSize: "12px",
                                    marginLeft: "16px",
                                }}
                            >
                                {errors.notes.message}
                            </p>
                        </IonText>
                    )}
                </IonItem>
            )}
        />
    );
};
