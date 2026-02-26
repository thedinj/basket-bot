import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { IonButton, IonCheckbox, IonIcon, IonItem, IonLabel, useIonAlert } from "@ionic/react";
import clsx from "clsx";
import { arrowRedoOutline, helpCircleOutline } from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useMoveItemToStore, useStores, useToggleItemChecked } from "../../db/hooks";
import { useMidnightUpdate } from "../../hooks/useMidnightUpdate";
import { useToast } from "../../hooks/useToast";
import { formatSnoozeDate, isCurrentlySnoozed } from "../../utils/dateUtils";
import type { SelectableItem } from "../shared/ClickableSelectionModal";
import { ClickableSelectionModal } from "../shared/ClickableSelectionModal";
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
    const { openEditModal } = useShoppingListContext();
    const [presentAlert] = useIonAlert();
    const toggleChecked = useToggleItemChecked();
    const moveItemToStore = useMoveItemToStore();
    const { data: stores } = useStores();
    const [isMoveToStoreModalOpen, setIsMoveToStoreModalOpen] = useState(false);

    const storeItems: SelectableItem[] = useMemo(() => {
        if (!stores) return [];
        return stores
            .filter((s) => s.id !== item.storeId && !s.isHidden)
            .map((store) => ({
                id: store.id,
                label: store.name,
            }));
    }, [stores, item.storeId]);

    const handleStoreSelectedForMove = useCallback(
        (storeId: string | null) => {
            if (storeId && stores) {
                const storeObj = stores.find((s) => s.id === storeId);
                if (storeObj) {
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
        },
        [
            item.id,
            item.isIdea,
            item.itemName,
            item.notes,
            item.qty,
            item.storeId,
            item.unitId,
            moveItemToStore,
            presentAlert,
            stores,
            toast,
        ]
    );

    const handleMoveIconClick = useCallback(() => {
        if (!stores || stores.length <= 1) return;

        const otherStores = stores.filter((s) => s.id !== item.storeId && !s.isHidden);

        // Special case: if exactly one other store, skip modal and go straight to confirmation
        if (otherStores.length === 1) {
            handleStoreSelectedForMove(otherStores[0].id);
        } else {
            setIsMoveToStoreModalOpen(true);
        }
    }, [handleStoreSelectedForMove, item.storeId, stores]);

    const handleDismissMoveModal = useCallback(() => {
        setIsMoveToStoreModalOpen(false);
    }, []);

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
                        {item.isUnsure ? (
                            <IonIcon
                                icon={helpCircleOutline}
                                className="unsure-icon"
                                title="Unsure if needed"
                            />
                        ) : null}
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
                        <p className={clsx("item-checked-by", isChecked && "item-text--checked")}>
                            Checked by {item.checkedByName}
                        </p>
                    )}
                </>
            </IonLabel>

            {stores && stores.length > 1 && (
                <IonButton
                    slot="end"
                    fill="clear"
                    onClick={handleMoveIconClick}
                    title="Move to another store"
                >
                    <IonIcon icon={arrowRedoOutline} color="medium" />
                </IonButton>
            )}

            <ClickableSelectionModal
                items={storeItems}
                value={undefined}
                onSelect={handleStoreSelectedForMove}
                isOpen={isMoveToStoreModalOpen}
                onDismiss={handleDismissMoveModal}
                title="Move to Store"
                showSearch={false}
                allowClear={false}
            />
        </IonItem>
    );
};
