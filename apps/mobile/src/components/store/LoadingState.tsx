import { IonList, IonItem, IonLabel, IonSkeletonText } from "@ionic/react";

export const LoadingState = () => {
    return (
        <IonList>
            {[1, 2, 3].map((i) => (
                <IonItem key={i}>
                    <IonLabel>
                        <IonSkeletonText animated style={{ width: "60%" }} />
                    </IonLabel>
                </IonItem>
            ))}
        </IonList>
    );
};
