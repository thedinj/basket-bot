import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useEffect, useState } from "react";
import { useUpdateHousehold } from "../../db/hooks";

interface EditHouseholdDetailsModalProps {
    householdId: string | null;
    currentName: string;
    isOpen: boolean;
    onClose: () => void;
}

const EditHouseholdDetailsModal: React.FC<EditHouseholdDetailsModalProps> = ({
    householdId,
    currentName,
    isOpen,
    onClose,
}) => {
    const updateHousehold = useUpdateHousehold();
    const [name, setName] = useState(currentName);

    // Reset name when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
        }
    }, [isOpen, currentName]);

    const handleSave = async () => {
        if (!householdId || !name.trim()) return;

        await updateHousehold.mutateAsync({ householdId, name: name.trim() });
        onClose();
    };

    const handleCancel = () => {
        setName(currentName);
        onClose();
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleCancel}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Edit Household Details</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleCancel}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <IonItem>
                    <IonLabel position="stacked">Household Name</IonLabel>
                    <IonInput
                        value={name}
                        onIonInput={(e) => setName(e.detail.value || "")}
                        placeholder="Enter household name"
                        disabled={updateHousehold.isPending}
                    />
                </IonItem>

                <div className="ion-padding-top">
                    <IonButton
                        expand="block"
                        onClick={handleSave}
                        disabled={!name.trim() || updateHousehold.isPending}
                    >
                        {updateHousehold.isPending ? "Saving..." : "Save"}
                    </IonButton>
                    <IonButton
                        expand="block"
                        fill="outline"
                        onClick={handleCancel}
                        disabled={updateHousehold.isPending}
                    >
                        Cancel
                    </IonButton>
                </div>
            </IonContent>
        </IonModal>
    );
};

export default EditHouseholdDetailsModal;
