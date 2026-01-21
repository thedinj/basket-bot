import { IonButton, IonDatetime, IonInput, IonItem, IonLabel, IonModal } from "@ionic/react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { formatShortDate } from "../../utils/dateUtils";
import { useItemEditorContext } from "./useItemEditorContext";

export const SnoozeDateSelector: React.FC = () => {
    const { control, setValue, watch } = useItemEditorContext();
    const snoozedUntil = watch("snoozedUntil");
    const [showModal, setShowModal] = useState(false);

    // Calculate tomorrow's date at 12AM as minimum
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0); // Set to start of today
    tomorrow.setDate(tomorrow.getDate() + 1); // Move to start of tomorrow
    const minDate = tomorrow.toISOString().split("T")[0];

    const clearSnooze = () => {
        setValue("snoozedUntil", null);
    };

    return (
        <>
            <IonItem>
                <IonLabel position="stacked">Snooze Until</IonLabel>
                {snoozedUntil ? (
                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            width: "100%",
                        }}
                    >
                        <IonInput
                            value={formatShortDate(snoozedUntil)}
                            readonly
                            style={{ flex: 1 }}
                        />
                        <IonButton size="small" fill="clear" onClick={() => setShowModal(true)}>
                            Update
                        </IonButton>
                        <IonButton size="small" fill="clear" onClick={clearSnooze}>
                            Clear
                        </IonButton>
                    </div>
                ) : (
                    <IonInput
                        onClick={() => setShowModal(true)}
                        readonly
                        placeholder="Set snooze date"
                        style={{
                            flex: 1,
                        }}
                    />
                )}
            </IonItem>
            <Controller
                name="snoozedUntil"
                control={control}
                render={({ field }) => (
                    <IonModal
                        isOpen={showModal}
                        onDidDismiss={() => setShowModal(false)}
                        initialBreakpoint={0.5}
                        breakpoints={[0, 0.5, 0.75]}
                    >
                        <IonDatetime
                            presentation="date"
                            min={minDate}
                            value={field.value || undefined}
                            onIonChange={(e) => {
                                const value = e.detail.value;
                                if (typeof value === "string") {
                                    // Convert to proper ISO datetime format with timezone
                                    const date = new Date(value);
                                    field.onChange(date.toISOString());
                                    setShowModal(false);
                                }
                            }}
                        />
                    </IonModal>
                )}
            />
        </>
    );
};
