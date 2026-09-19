import { IonButton, IonContent, IonInput, IonModal } from "@ionic/react";
import React, { useEffect, useRef, useState } from "react";
import { useUpdateHousehold } from "../../db/hooks";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";

import "./Households.scss";

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
    const nameInputRef = useRef<HTMLIonInputElement>(null);

    // Reset name when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
        }
    }, [isOpen, currentName]);

    const canSave = !!householdId && !!name.trim() && !updateHousehold.isPending;

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!householdId || !canSave) return;

        await updateHousehold.mutateAsync({ householdId, name: name.trim() });
        onClose();
    };

    const handleCancel = () => {
        setName(currentName);
        onClose();
    };

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleCancel}
            onDidPresent={() => nameInputRef.current?.setFocus()}
        >
            <ModalHeader
                title="Edit Household"
                onClose={handleCancel}
                closeDisabled={updateHousehold.isPending}
            />
            <IonContent className="ion-padding">
                <form className="editor-form" onSubmit={handleSave}>
                    <FormField label="Name">
                        <div className="form-control">
                            <IonInput
                                ref={nameInputRef}
                                aria-label="Household name"
                                value={name}
                                onIonInput={(e) => setName(e.detail.value || "")}
                                placeholder="Household name"
                                autocapitalize="words"
                                enterkeyhint="done"
                                disabled={updateHousehold.isPending}
                            />
                        </div>
                    </FormField>
                </form>
            </IonContent>
            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    onClick={() => handleSave()}
                    disabled={!canSave}
                >
                    {updateHousehold.isPending ? "Saving..." : "Save Changes"}
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

export default EditHouseholdDetailsModal;
