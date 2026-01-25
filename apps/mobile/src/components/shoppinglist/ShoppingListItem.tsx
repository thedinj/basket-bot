import type { ShoppingListItemWithDetails, Store } from "@basket-bot/core";
import {
    IonAlert,
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
} from "@ionic/react";
import { closeOutline, swapHorizontalOutline } from "ionicons/icons";
import { useMemo, useState } from "react";
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

const useSnoozeStatus = (snoozedUntil: string | null, currentDate: string) => {
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
    const { openEditModal, newlyImportedItemIds } = useShoppingListContext();
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [pendingMove, setPendingMove] = useState<Store | null>(null);
    const currentDate = useMidnightUpdate();
    const toggleChecked = useToggleItemChecked();
    const moveItemToStore = useMoveItemToStore();
    const { data: stores } = useStores();

    const isNewlyImported = newlyImportedItemIds.has(item.id);

    const handleStoreSelected = (storeId: string | null) => {
        if (storeId && stores) {
            const storeObj = stores.find((s) => s.id === storeId);
            if (storeObj) {
                setPendingMove(storeObj);
                setShowMoveModal(false);
            }
        }
    };

    const handleMoveToStore = async () => {
        if (!pendingMove) return;

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
                targetStoreId: pendingMove.id,
                targetStoreName: pendingMove.name,
            });

            toast.showSuccess(
                `Moved "${result.itemName}" to ${result.targetStoreName}. Obviously.`
            );
            setPendingMove(null);
        } catch (error) {
            toast.showError("Failed to move item. Perhaps try again?");
            console.error("Error moving item to store:", error);
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

    const itemStyle = isChecked
        ? {
              textDecoration: "line-through",
              opacity: 0.6,
          }
        : {};

    const titleToUse = item.isIdea ? item.notes : item.itemName;
    const notesToUse = item.isIdea ? "" : item.notes;

    // Check if item is snoozed (recalculates at midnight via currentDate dependency)
    const { isSnoozed, formattedSnoozeDate } = useSnoozeStatus(item.snoozedUntil, currentDate);

    return (
        <IonItem style={itemStyle} button={false}>
            <div
                slot="start"
                style={{
                    display: "flex",
                    alignItems: "center",
                    paddingRight: "8px",
                    cursor: "pointer",
                }}
                onClick={handleCheckboxClick}
                onTouchStart={(e) => {
                    e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                    e.stopPropagation();
                    handleCheckboxClick(e);
                }}
            >
                <IonCheckbox checked={isChecked} style={{ pointerEvents: "none" }} />
            </div>
            <IonLabel
                style={{ cursor: "pointer" }}
                onClick={() => openEditModal(item as ShoppingListItemWithDetails)}
            >
                <>
                    <h2
                        className={isNewlyImported ? "shimmer-text" : ""}
                        style={{
                            color: isSnoozed ? "var(--ion-color-medium)" : undefined,
                        }}
                    >
                        {titleToUse}{" "}
                        {(item.qty !== null || item.unitAbbreviation) && (
                            <span>
                                ({item.qty !== null ? item.qty : ""}
                                {item.unitAbbreviation && ` ${item.unitAbbreviation}`})
                            </span>
                        )}{" "}
                        {item.isSample ? (
                            <span
                                style={{
                                    fontSize: "0.6em",
                                    textTransform: "uppercase",
                                    color: "var(--ion-color-medium)",
                                }}
                            >
                                [sample]
                            </span>
                        ) : null}
                    </h2>
                    {notesToUse && <p style={{ fontStyle: "italic" }}>{notesToUse}</p>}
                    {isSnoozed && (
                        <p
                            style={{
                                fontSize: "0.85em",
                                color: "var(--ion-color-medium)",
                                marginTop: notesToUse ? "4px" : "0",
                                fontStyle: "italic",
                            }}
                        >
                            Snoozed until {formattedSnoozeDate}
                        </p>
                    )}
                </>
            </IonLabel>

            {stores && stores.length > 1 && (
                <IonButton slot="end" fill="clear" onClick={() => setShowMoveModal(true)}>
                    <IonIcon icon={swapHorizontalOutline} color="medium" />
                </IonButton>
            )}

            <IonAlert
                isOpen={!!pendingMove}
                onDidDismiss={() => setPendingMove(null)}
                header="Move to Store"
                message={`Move this item  to ${
                    pendingMove?.name ?? "the other store"
                }? The item will be removed from the current store and added to the selected store.`}
                buttons={[
                    {
                        text: "Cancel",
                        role: "cancel",
                        handler: () => setPendingMove(null),
                    },
                    {
                        text: "Move",
                        handler: handleMoveToStore,
                    },
                ]}
            />

            {/* Move to Store Modal */}
            <IonModal isOpen={showMoveModal} onDidDismiss={() => setShowMoveModal(false)}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Move to Store</IonTitle>
                        <IonButtons slot="end">
                            <IonButton
                                onClick={() => {
                                    setShowMoveModal(false);
                                    setPendingMove(null);
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
