import type { Store } from "@basket-bot/core";
import { IonButton, IonContent, IonModal } from "@ionic/react";
import React, { useState } from "react";
import { useHouseholds, useUpdateStoreHousehold } from "../../db/hooks";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";
import RobotLoadingContent from "../shared/RobotLoadingContent";
import StoreChoice from "./StoreChoice";

import "./StoreSheets.scss";

type StoreHouseholdSharingModalProps = {
    store: Store | null;
    isOpen: boolean;
    onClose: () => void;
};

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
    const hasHouseholds = !isLoading && !error && !!households && households.length > 0;

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
            <ModalHeader title="Share Store" onClose={handleClose} />
            <IonContent className="ion-padding">
                {isLoading ? (
                    <div className="store-sheet-loading">
                        <RobotLoadingContent />
                    </div>
                ) : error ? (
                    <p className="store-sheet-message store-sheet-message--error" role="alert">
                        Failed to load households
                    </p>
                ) : (
                    <div className="editor-form">
                        <FormField label="Share with household">
                            {!households || households.length === 0 ? (
                                <p className="store-sheet-message">
                                    No households available. Create a household first to share
                                    stores.
                                </p>
                            ) : (
                                <div
                                    className="boxed-list"
                                    role="radiogroup"
                                    aria-label="Share with household"
                                >
                                    <StoreChoice
                                        title="Private"
                                        description="Only you can access this store"
                                        selected={selectedHouseholdId === null}
                                        onSelect={() => setSelectedHouseholdId(null)}
                                    />
                                    {households.map((household) => (
                                        <StoreChoice
                                            key={household.id}
                                            title={household.name}
                                            description="All household members can access"
                                            selected={selectedHouseholdId === household.id}
                                            onSelect={() => setSelectedHouseholdId(household.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </FormField>
                    </div>
                )}
            </IonContent>
            {hasHouseholds && (
                <EditorFooter>
                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        onClick={handleSave}
                        disabled={!hasChanges || updateStoreHousehold.isPending}
                    >
                        {updateStoreHousehold.isPending ? "Saving..." : "Save"}
                    </IonButton>
                </EditorFooter>
            )}
        </IonModal>
    );
};

export default StoreHouseholdSharingModal;
