import { IonItem, IonLabel, IonToggle } from "@ionic/react";
import { Controller } from "react-hook-form";
import { useItemEditorContext } from "./useItemEditorContext";

export const UnsureToggle = () => {
    const { control } = useItemEditorContext();

    return (
        <Controller
            name="isUnsure"
            control={control}
            render={({ field }) => (
                <IonItem>
                    <IonLabel position="stacked">Unsure if Needed?</IonLabel>
                    <IonToggle
                        checked={field.value ?? false}
                        onIonChange={(e) => field.onChange(e.detail.checked)}
                    />
                </IonItem>
            )}
        />
    );
};
