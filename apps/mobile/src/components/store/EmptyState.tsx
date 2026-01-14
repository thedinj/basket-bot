import { IonText } from "@ionic/react";

export const EmptyState = () => {
    return (
        <div
            style={{
                textAlign: "center",
                marginTop: "40px",
                padding: "20px",
            }}
        >
            <IonText color="medium">
                <p>
                    No aisles configured. Tap + to organize this store properly.
                </p>
            </IonText>
        </div>
    );
};
