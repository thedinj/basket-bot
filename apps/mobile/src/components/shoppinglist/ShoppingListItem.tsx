import type { ShoppingListItemWithDetails, Store } from "@basket-bot/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
    IonButton,
    IonCheckbox,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
} from "@ionic/react";
import clsx from "clsx";
import {
    arrowRedoOutline,
    checkmarkCircleOutline,
    closeCircleOutline,
    helpCircle,
    helpCircleOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import {
    useMoveItemToStore,
    useStores,
    useSwipeUpdateShoppingListItem,
    useToggleItemChecked,
} from "../../db/hooks";
import { useMidnightUpdate } from "../../hooks/useMidnightUpdate";
import { useToast } from "../../hooks/useToast";
import {
    formatSnoozeDate,
    formatSnoozeDateForStorage,
    isCurrentlySnoozed,
} from "../../utils/dateUtils";
import { toUpsertPayload } from "../../utils/shoppingListItemPayload";
import type { SelectableItem } from "../shared/ClickableSelectionModal";
import { ClickableSelectionModal } from "../shared/ClickableSelectionModal";
import ConfirmModal from "../shared/ConfirmModal";
import { SNOOZE_PRESETS } from "./SnoozeChips";
import { useShoppingListContext } from "./useShoppingListContext";

import "./ShoppingListItem.css";

interface ShoppingListItemProps {
    item: ShoppingListItemWithDetails;
    isChecked: boolean;
    /**
     * When provided (together with `onRejectUnsure`), this is the Review Unsure Items view:
     * the checkbox and move-to-store button are replaced with "I don't need this" /
     * "Confirm — I need this" actions, and calling this handler is the confirm side. Every
     * row here is already known to be unsure, so the unsure icon/styling is redundant and
     * suppressed too.
     */
    onConfirmUnsure?: () => void;
    isConfirmingUnsure?: boolean;
    /** The reject side of unsure review — deletes the item outright. See `onConfirmUnsure`. */
    onRejectUnsure?: () => void;
    isRejectingUnsure?: boolean;
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

export const ShoppingListItem = ({
    item,
    isChecked,
    onConfirmUnsure,
    isConfirmingUnsure,
    onRejectUnsure,
    isRejectingUnsure,
}: ShoppingListItemProps) => {
    const toast = useToast();
    const { user } = useAuth();
    const { openEditModal } = useShoppingListContext();
    const [pendingMoveStore, setPendingMoveStore] = useState<Store | null>(null);
    const toggleChecked = useToggleItemChecked();
    const moveItemToStore = useMoveItemToStore();
    const { data: stores } = useStores();
    const [isMoveToStoreModalOpen, setIsMoveToStoreModalOpen] = useState(false);
    const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
    const [justChecked, setJustChecked] = useState(false);
    const [showZzz, setShowZzz] = useState(false);
    const prevSnoozedRef = useRef<boolean>(false);
    const slidingRef = useRef<HTMLIonItemSlidingElement>(null);
    const markUnsure = useSwipeUpdateShoppingListItem("mark item unsure");
    const snoozeItem = useSwipeUpdateShoppingListItem("snooze item");
    const { isSnoozed } = useSnoozeStatus(item.snoozedUntil);

    const swipePresetDates = useMemo(
        () =>
            SNOOZE_PRESETS.map((preset) => {
                const date = new Date();
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + preset.days);
                return { ...preset, date: formatSnoozeDateForStorage(date.toISOString()) };
            }),
        []
    );

    const handleSwipeToggleUnsure = useCallback(() => {
        slidingRef.current?.close();
        markUnsure.mutate(toUpsertPayload(item, { isUnsure: !item.isUnsure }));
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    }, [item, markUnsure]);

    const handleSwipeSnooze = useCallback(
        (snoozedUntil: string | null) => {
            slidingRef.current?.close();
            snoozeItem.mutate(toUpsertPayload(item, { snoozedUntil }));
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
        },
        [item, snoozeItem]
    );

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
                const store = stores.find((s) => s.id === storeId);
                if (store) {
                    setPendingMoveStore(store);
                }
            }
        },
        [stores]
    );

    const handleConfirmMove = useCallback(async () => {
        if (!pendingMoveStore) return;
        try {
            const result = await moveItemToStore.mutateAsync({
                item: {
                    id: item.id,
                    itemName: item.itemName,
                    notes: item.notes,
                    qty: item.qty,
                    unitId: item.unitId,
                    isIdea: item.isIdea,
                    isSample: item.isSample,
                    isUnsure: item.isUnsure,
                    isPrivate: item.isPrivate,
                    snoozedUntil: item.snoozedUntil,
                },
                sourceStoreId: item.storeId,
                targetStoreId: pendingMoveStore.id,
                targetStoreName: pendingMoveStore.name,
            });
            toast.showSuccess(`Moved "${result.itemName}" to ${result.targetStoreName}`);
        } catch (_error) {
            // Toast is shown by the global MutationCache error handler; this catch
            // only exists so mutateAsync's rejection doesn't surface as an unhandled
            // promise rejection.
        }
    }, [
        pendingMoveStore,
        moveItemToStore,
        item.id,
        item.isIdea,
        item.isPrivate,
        item.isSample,
        item.isUnsure,
        item.itemName,
        item.notes,
        item.qty,
        item.snoozedUntil,
        item.storeId,
        item.unitId,
        toast,
    ]);

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

    const handleDismissConfirmModal = useCallback(() => {
        setPendingMoveStore(null);
    }, []);

    const handleRejectIconClick = useCallback(() => {
        setIsRejectConfirmOpen(true);
    }, []);

    const handleDismissRejectConfirm = useCallback(() => {
        setIsRejectConfirmOpen(false);
    }, []);

    const handleConfirmReject = useCallback(() => {
        setIsRejectConfirmOpen(false);
        onRejectUnsure?.();
    }, [onRejectUnsure]);

    const handleCheckboxChange = (checked: boolean) => {
        toggleChecked.mutate({
            id: item.id,
            isChecked: checked,
            storeId: item.storeId,
        });
        // Light haptic + spring bounce animation
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
        setJustChecked(true);
        setTimeout(() => setJustChecked(false), 350);
    };

    const handleCheckboxClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleCheckboxChange(!isChecked);
    };

    const titleToUse = item.isIdea ? item.notes : item.itemName;
    const notesToUse = item.isIdea ? "" : item.notes;

    const formattedSnoozeDate = isSnoozed ? formatSnoozeDate(item.snoozedUntil!) : null;

    // Trigger Zzz animation when item transitions into snoozed state
    useEffect(() => {
        if (isSnoozed && !prevSnoozedRef.current) {
            setShowZzz(true);
            const timer = setTimeout(() => setShowZzz(false), 1600);
            prevSnoozedRef.current = isSnoozed;
            return () => clearTimeout(timer);
        }
        prevSnoozedRef.current = isSnoozed;
    }, [isSnoozed]);

    // Swipe actions only make sense on unchecked rows and outside the unsure-review UI,
    // which already has its own explicit confirm/reject buttons.
    const swipeActionsEnabled = !isChecked && !onConfirmUnsure;

    return (
        <IonItemSliding ref={slidingRef} disabled={!swipeActionsEnabled}>
            <IonItem
                className={clsx(
                    isChecked && "shopping-list-item--checked",
                    item.isIdea && "shopping-list-item--idea",
                    item.isUnsure && !onConfirmUnsure && "shopping-list-item--unsure",
                    item.isPrivate && "shopping-list-item--private",
                    justChecked && "shopping-list-item--just-checked"
                )}
                button={false}
            >
                {!onConfirmUnsure && (
                    <div
                        slot="start"
                        className={clsx(
                            "checkbox-container",
                            justChecked && "checkbox-container--bounce"
                        )}
                        onClick={handleCheckboxClick}
                    >
                        <IonCheckbox checked={isChecked} style={{ pointerEvents: "none" }} />
                        {showZzz && (
                            <div className="zzz-particles" aria-hidden="true">
                                <span className="zzz-particle zzz-particle--1">z</span>
                                <span className="zzz-particle zzz-particle--2">z</span>
                                <span className="zzz-particle zzz-particle--3">Z</span>
                            </div>
                        )}
                    </div>
                )}
                <IonLabel
                    className={clsx(
                        "item-label",
                        isChecked && "item-text--checked",
                        isSnoozed && "item-text--snoozed"
                    )}
                    onClick={() => openEditModal(item as ShoppingListItemWithDetails)}
                >
                    <>
                        <h2 className={clsx("item-title")}>
                            {titleToUse}{" "}
                            {(item.qty !== null || item.unitAbbreviation) && (
                                <span className="item-qty">
                                    ({item.qty !== null ? item.qty : ""}
                                    {item.unitAbbreviation && ` ${item.unitAbbreviation}`})
                                </span>
                            )}{" "}
                            {item.isSample ? <span className="sample-badge">[sample]</span> : null}
                            {item.isUnsure && !onConfirmUnsure ? (
                                <IonIcon
                                    icon={isChecked ? helpCircleOutline : helpCircle}
                                    className="unsure-icon"
                                    title="Unsure if needed"
                                />
                            ) : null}
                            {item.isPrivate ? (
                                <IonIcon
                                    src="/img/private.svg"
                                    className="private-icon"
                                    title="Incognito — only visible to you"
                                />
                            ) : null}
                        </h2>

                        {notesToUse && (
                            <p className={clsx("item-notes", isChecked && "item-text--checked")}>
                                {notesToUse}
                            </p>
                        )}
                        {isSnoozed && (
                            <p
                                className={clsx(
                                    "item-snoozed-info",
                                    isChecked && "item-text--checked"
                                )}
                            >
                                Snoozed until {formattedSnoozeDate}
                            </p>
                        )}
                        {item.isChecked && item.checkedBy !== user?.id && item.checkedByName && (
                            <p
                                className={clsx(
                                    "item-checked-by",
                                    isChecked && "item-text--checked"
                                )}
                            >
                                Checked by {item.checkedByName}
                            </p>
                        )}
                    </>
                </IonLabel>

                {onConfirmUnsure ? (
                    <>
                        <IonButton
                            slot="end"
                            fill="clear"
                            onClick={handleRejectIconClick}
                            disabled={isRejectingUnsure}
                            title="I don't need this — remove it"
                        >
                            <IonIcon icon={closeCircleOutline} color="danger" />
                        </IonButton>
                        <IonButton
                            slot="end"
                            fill="clear"
                            onClick={onConfirmUnsure}
                            disabled={isConfirmingUnsure}
                            title="Confirm — I need this"
                        >
                            <IonIcon icon={checkmarkCircleOutline} color="success" />
                        </IonButton>
                    </>
                ) : (
                    stores &&
                    stores.length > 1 &&
                    !isChecked && (
                        <IonButton
                            slot="end"
                            fill="clear"
                            onClick={handleMoveIconClick}
                            title="Move to another store"
                        >
                            <IonIcon icon={arrowRedoOutline} color="medium" />
                        </IonButton>
                    )
                )}
            </IonItem>

            {swipeActionsEnabled && (
                <IonItemOptions side="end">
                    <IonItemOption
                        className="swipe-option swipe-option--unsure"
                        onClick={handleSwipeToggleUnsure}
                    >
                        <IonIcon slot="top" icon={item.isUnsure ? helpCircle : helpCircleOutline} />
                        {item.isUnsure ? "Confirm" : "Unsure"}
                    </IonItemOption>
                    {isSnoozed ? (
                        <IonItemOption
                            className="swipe-option swipe-option--snooze"
                            onClick={() => handleSwipeSnooze(null)}
                        >
                            <IonIcon slot="top" src="/img/ZzzIcon.svg" />
                            Un-snooze
                        </IonItemOption>
                    ) : (
                        swipePresetDates.map((preset) => (
                            <IonItemOption
                                key={preset.label}
                                className="swipe-option swipe-option--snooze"
                                onClick={() => handleSwipeSnooze(preset.date)}
                            >
                                <IonIcon slot="top" src="/img/ZzzIcon.svg" />
                                {preset.days === 1 ? "1d" : "1w"}
                            </IonItemOption>
                        ))
                    )}
                </IonItemOptions>
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
            <ConfirmModal
                isOpen={pendingMoveStore !== null}
                onDidDismiss={handleDismissConfirmModal}
                title="Move to Store"
                message={
                    <p>
                        Move this item to{" "}
                        <strong className="store-name-highlight">{pendingMoveStore?.name}</strong>?
                        The item will be removed from the current store and added to the selected
                        store.
                    </p>
                }
                confirmText="Move"
                onConfirm={handleConfirmMove}
                onCancel={handleDismissConfirmModal}
            />
            {onRejectUnsure && (
                <ConfirmModal
                    isOpen={isRejectConfirmOpen}
                    onDidDismiss={handleDismissRejectConfirm}
                    title="Remove Item?"
                    message={<p>Remove &quot;{titleToUse}&quot; from your shopping list?</p>}
                    confirmText="Remove"
                    confirmColor="danger"
                    onConfirm={handleConfirmReject}
                    onCancel={handleDismissRejectConfirm}
                />
            )}
        </IonItemSliding>
    );
};
