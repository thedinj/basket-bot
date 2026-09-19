import { IonButton, IonContent, IonInput, IonModal } from "@ionic/react";
import React, { useRef, useState } from "react";
import { useCreateHousehold } from "../../db/hooks";
import { useHousehold } from "../../households/useHousehold";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";

import "./Households.scss";

interface CreateHouseholdModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateHouseholdModal: React.FC<CreateHouseholdModalProps> = ({ isOpen, onClose }) => {
    const [name, setName] = useState("");
    const nameInputRef = useRef<HTMLIonInputElement>(null);
    const createHousehold = useCreateHousehold();
    const { refreshHouseholds } = useHousehold();

    const canSubmit = !!name.trim() && !createHousehold.isPending;

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!canSubmit) return;

        await createHousehold.mutateAsync(name.trim());
        await refreshHouseholds();
        setName("");
        onClose();
    };

    const handleClose = () => {
        setName("");
        onClose();
    };

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleClose}
            onDidPresent={() => nameInputRef.current?.setFocus()}
        >
            <ModalHeader title="New Household" onClose={handleClose} />
            <IonContent className="ion-padding">
                <form className="editor-form" onSubmit={handleSubmit}>
                    <FormField label="Name">
                        <div className="form-control">
                            <IonInput
                                ref={nameInputRef}
                                aria-label="Household name"
                                value={name}
                                onIonInput={(e) => setName(e.detail.value || "")}
                                placeholder="e.g. Family, Roommates"
                                autocapitalize="words"
                                enterkeyhint="done"
                                required
                                disabled={createHousehold.isPending}
                            />
                        </div>
                    </FormField>
                </form>
            </IonContent>
            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    onClick={() => handleSubmit()}
                    disabled={!canSubmit}
                >
                    {createHousehold.isPending ? "Creating..." : "Create Household"}
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

export default CreateHouseholdModal;
