import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useState } from "react";
import { useCreateHousehold } from "../../db/hooks";

interface CreateHouseholdModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateHouseholdModal: React.FC<CreateHouseholdModalProps> = ({ isOpen, onClose }) => {
    const [name, setName] = useState("");
    const createHousehold = useCreateHousehold();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        await createHousehold.mutateAsync(name.trim());
        setName("");
        onClose();
    };

    const handleClose = () => {
        setName("");
        onClose();
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Create Household</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit}>
                    <IonList>
                        <IonItem>
                            <IonLabel position="stacked">Household Name</IonLabel>
                            <IonInput
                                value={name}
                                onIonInput={(e) => setName(e.detail.value || "")}
                                placeholder="e.g., Family, Roommates"
                                required
                                disabled={createHousehold.isPending}
                            />
                        </IonItem>
                    </IonList>

                    <div className="ion-padding">
                        <IonButton
                            expand="block"
                            type="submit"
                            disabled={!name.trim() || createHousehold.isPending}
                        >
                            {createHousehold.isPending ? "Creating..." : "Create"}
                        </IonButton>
                    </div>
                </form>
            </IonContent>
        </IonModal>
    );
};

export default CreateHouseholdModal;
