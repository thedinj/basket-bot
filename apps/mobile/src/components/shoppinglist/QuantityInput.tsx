import { IonInput, IonItem, IonLabel, IonText } from "@ionic/react";
import { Controller } from "react-hook-form";
import { useItemEditorContext } from "./useItemEditorContext";

export const QuantityInput = () => {
    const { control, errors } = useItemEditorContext();

    return (
        <>
            <Controller
                name="qty"
                control={control}
                render={({ field }) => (
                    <IonItem>
                        <IonLabel position="stacked">Quantity</IonLabel>
                        <IonInput
                            value={field.value}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Enter quantity"
                            onIonInput={(e) => {
                                const val = e.detail.value;
                                field.onChange(val ? parseFloat(val) : null);
                            }}
                        />
                    </IonItem>
                )}
            />
            {errors.qty && (
                <IonText color="danger">
                    <p
                        style={{
                            fontSize: "12px",
                            marginLeft: "16px",
                        }}
                    >
                        {errors.qty.message}
                    </p>
                </IonText>
            )}
        </>
    );
};
