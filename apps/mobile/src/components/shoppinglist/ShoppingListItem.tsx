import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonModal,
    IonTitle,
    IonToolbar,
    useIonAlert,
} from "@ionic/react";
import clsx from "clsx";
import { closeOutline, swapHorizontalOutline } from "ionicons/icons";
import { useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useMoveItemToStore, useStores, useToggleItemChecked } from "../../db/hooks";
import { useMidnightUpdate } from "../../hooks/useMidnightUpdate";
import { useToast } from "../../hooks/useToast";
import { formatSnoozeDate, isCurrentlySnoozed } from "../../utils/dateUtils";
import { GenericStoreSelector } from "../shared/GenericStoreSelector";
import { useShoppingListContext } from "./useShoppingListContext";

import "./ShoppingListItem.css";

interface ShoppingListItemProps {
    item: ShoppingListItemWithDetails;
    isChecked: boolean;
}

const useSnoozeStatus = (snoozedUntil: string | null) => {
    // Only enable midnight updates if the item is actually snoozed
    const currentDate = useMidnightUpdate(snoozedUntil !== null);
    return useMemo(() => {
        const snoozed = isCurrentlySnoozed(snoozedUntil);
        return {
            isSnoozed: snoozed,
            formattedSnoozeDate: snoozed ? formatSnoozeDate(snoozedUntil!) : null,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snoozedUntil, currentDate]);
};

export const ShoppingListItem = ({ item, isChecked }: ShoppingListItemProps) => {
    const toast = useToast();
    const { user } = useAuth();
    const { openEditModal, newlyImportedItemIds } = useShoppingListContext();
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [presentAlert] = useIonAlert();
    const toggleChecked = useToggleItemChecked();
    const moveItemToStore = useMoveItemToStore();
    const { data: stores } = useStores();

    const isNewlyImported = newlyImportedItemIds.has(item.id);

    const handleStoreSelected = (storeId: string | null) => {
        if (storeId && stores) {
            const storeObj = stores.find((s) => s.id === storeId);
            if (storeObj) {
                setShowMoveModal(false);
                presentAlert({
                    header: "Move to Store",
                    message: `Move this item to ${storeObj.name}? The item will be removed from the current store and added to the selected store.`,
                    buttons: [
                        {
                            text: "Cancel",
                            role: "cancel",
                        },
                        {
                            text: "Move",
                            handler: async () => {
                                try {
                                    const result = await moveItemToStore.mutateAsync({
                                        item: {
                                            id: item.id,
                                            itemName: item.itemName,
                                            notes: item.notes,
                                            qty: item.qty,
                                            unitId: item.unitId,
                                            isIdea: item.isIdea,
                                        },
                                        sourceStoreId: item.storeId,
                                        targetStoreId: storeObj.id,
                                        targetStoreName: storeObj.name,
                                    });
                                    toast.showSuccess(
                                        `Moved "${result.itemName}" to ${result.targetStoreName}`
                                    );
                                } catch (_error) {
                                    // Error already handled by mutation
                                }
                            },
                        },
                    ],
                });
            }
        }
    };

    const handleCheckboxChange = (checked: boolean) => {
        toggleChecked.mutate({
            id: item.id,
            isChecked: checked,
            storeId: item.storeId,
        });
    };

    const handleCheckboxClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleCheckboxChange(!isChecked);
    };

    const titleToUse = item.isIdea ? item.notes : item.itemName;
    const notesToUse = item.isIdea ? "" : item.notes;

    const { isSnoozed, formattedSnoozeDate } = useSnoozeStatus(item.snoozedUntil);

    return (
        <IonItem className={isChecked ? "shopping-list-item--checked" : ""} button={false}>
            <div slot="start" className="checkbox-container" onClick={handleCheckboxClick}>
                <IonCheckbox checked={isChecked} style={{ pointerEvents: "none" }} />
            </div>
            <IonLabel
                className="item-label"
                onClick={() => openEditModal(item as ShoppingListItemWithDetails)}
            >
                <>
                    <h2
                        className={clsx(
                            "item-title",
                            isNewlyImported && "shimmer-text",
                            isChecked && "item-text--checked",
                            isSnoozed && "item-text--snoozed"
                        )}
                    >
                        {titleToUse}{" "}
                        {(item.qty !== null || item.unitAbbreviation) && (
                            <span>
                                ({item.qty !== null ? item.qty : ""}
                                {item.unitAbbreviation && ` ${item.unitAbbreviation}`})
                            </span>
                        )}{" "}
                        {item.isSample ? <span className="sample-badge">[sample]</span> : null}
                    </h2>

                    {notesToUse && (
                        <p className={clsx("item-notes", isChecked && "item-text--checked")}>
                            {notesToUse}
                        </p>
                    )}
                    {isSnoozed && (
                        <p className={clsx("item-snoozed-info", isChecked && "item-text--checked")}>
                            Snoozed until {formattedSnoozeDate}
                        </p>
                    )}
                    {item.isChecked && item.checkedBy !== user?.id && item.checkedByName && (
                        <p className="item-checked-by">Checked by {item.checkedByName}</p>
                    )}
                </>
            </IonLabel>

            {stores && stores.length > 1 && (
                <IonButton slot="end" fill="clear" onClick={() => setShowMoveModal(true)}>
                    <IonIcon icon={swapHorizontalOutline} color="medium" />
                </IonButton>
            )}

            {/* Move to Store Modal */}
            <IonModal isOpen={showMoveModal} onDidDismiss={() => setShowMoveModal(false)}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Move to Store</IonTitle>
                        <IonButtons slot="end">
                            <IonButton
                                onClick={() => {
                                    setShowMoveModal(false);
                                }}
                            >
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    <GenericStoreSelector
                        selectedStoreId={null}
                        onStoreSelect={handleStoreSelected}
                        modalTitle="Select Destination Store"
                        placeholderText="Select destination store"
                        excludeStoreIds={[item.storeId]}
                        allowClear={false}
                    />
                </IonContent>
            </IonModal>
        </IonItem>
    );
};
