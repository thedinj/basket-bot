import type { Store } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useState } from "react";
import { useHouseholds, useUpdateStoreHousehold } from "../../db/hooks";

interface StoreHouseholdSharingModalProps {
    store: Store | null;
    isOpen: boolean;
    onClose: () => void;
}

const StoreHouseholdSharingModal: React.FC<StoreHouseholdSharingModalProps> = ({
    store,
    isOpen,
    onClose,
}) => {
    const { data: households, isLoading, error } = useHouseholds();
    const updateStoreHousehold = useUpdateStoreHousehold();

    const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

    // Sync local state with store prop when modal opens
    React.useEffect(() => {
        if (isOpen && store) {
            setSelectedHouseholdId(store.householdId || null);
        }
    }, [isOpen, store]);

    const handleSave = async () => {
        if (!store) return;

        await updateStoreHousehold.mutateAsync({
            storeId: store.id,
            householdId: selectedHouseholdId,
        });
        onClose();
    };

    const handleClose = () => {
        // Reset to store's current value on cancel
        setSelectedHouseholdId(store?.householdId || null);
        onClose();
    };

    const hasChanges = store && selectedHouseholdId !== (store.householdId || null);

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Share Store</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                {isLoading ? (
                    <div className="ion-text-center ion-padding">
                        <IonSpinner />
                    </div>
                ) : null}

                {error ? (
                    <IonText color="danger">
                        <p className="ion-padding">Failed to load households</p>
                    </IonText>
                ) : null}

                {!isLoading && !error ? (
                    <IonList>
                        <IonListHeader>
                            <h2>Share with Household</h2>
                        </IonListHeader>

                        {!households || households.length === 0 ? (
                            <IonItem>
                                <IonLabel>
                                    <IonNote>
                                        No households available. Create a household first to share
                                        stores.
                                    </IonNote>
                                </IonLabel>
                            </IonItem>
                        ) : (
                            <IonRadioGroup
                                value={selectedHouseholdId || "private"}
                                onIonChange={(e) =>
                                    setSelectedHouseholdId(
                                        e.detail.value === "private" ? null : e.detail.value
                                    )
                                }
                            >
                                <IonItem>
                                    <IonLabel>
                                        <h3>Private</h3>
                                        <p>Only you can access this store</p>
                                    </IonLabel>
                                    <IonRadio slot="end" value="private" />
                                </IonItem>

                                {households.map((household) => (
                                    <IonItem key={household.id}>
                                        <IonLabel>
                                            <h3>{household.name}</h3>
                                            <p>All household members can access</p>
                                        </IonLabel>
                                        <IonRadio slot="end" value={household.id} />
                                    </IonItem>
                                ))}
                            </IonRadioGroup>
                        )}

                        {households && households.length > 0 ? (
                            <div className="ion-padding">
                                <IonButton
                                    expand="block"
                                    onClick={handleSave}
                                    disabled={!hasChanges || updateStoreHousehold.isPending}
                                >
                                    {updateStoreHousehold.isPending ? "Saving..." : "Save"}
                                </IonButton>
                            </div>
                        ) : null}
                    </IonList>
                ) : null}
            </IonContent>
        </IonModal>
    );
};

export default StoreHouseholdSharingModal;
