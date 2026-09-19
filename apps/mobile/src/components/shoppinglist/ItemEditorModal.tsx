import type { ItemFormData, ShoppingListItem } from "@basket-bot/core";
import { shoppingListItemInputSchema } from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonAlert,
    IonButton,
    IonContent,
    IonIcon,
    IonLabel,
    IonModal,
    IonSegment,
    IonSegmentButton,
} from "@ionic/react";
import { UseMutationResult } from "@tanstack/react-query";
import { bulbOutline, cartOutline, informationCircleOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
    useDeleteShoppingListItem,
    useGetOrCreateStoreItem,
    useUpdateItem,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import { isCurrentlySnoozed } from "../../utils/dateUtils";
import { DestructiveAction } from "../shared/DestructiveAction";
import ItemInfoModal from "../shared/ItemInfoModal";
import { ModalHeader } from "../shared/ModalHeader";
import { ItemEditorProvider } from "./ItemEditorContext";
import { LocationSelectors } from "./LocationSelectors";
import { NameAutocomplete } from "./NameAutocomplete";
import { NotesInput } from "./NotesInput";
import { PrivateToggle } from "./PrivateToggle";
import { QuantityAndUnitRow } from "./QuantityAndUnitRow";
import { SnoozeDateSelector } from "./SnoozeDateSelector";
import { UnsureToggle } from "./UnsureToggle";
import { useItemEditorContext } from "./useItemEditorContext";
import { useShoppingListContext } from "./useShoppingListContext";

interface ItemEditorModalProps {
    storeId: string;
}

export const ItemEditorModal = ({ storeId }: ItemEditorModalProps) => {
    const { isItemModalOpen, editingItem, closeItemModal } = useShoppingListContext();
    // Editing an item always saves/deletes to the store it actually belongs to, not
    // whichever store's page this modal happens to be mounted under — `storeId` is only
    // the default used when creating a brand-new item.
    const effectiveStoreId = editingItem?.storeId ?? storeId;
    const upsertItem = useUpsertShoppingListItem();
    const getOrCreateStoreItem = useGetOrCreateStoreItem();
    const updateItem = useUpdateItem();
    const deleteItem = useDeleteShoppingListItem();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const nameInputRef = useRef<HTMLIonInputElement>(null);

    const {
        control,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors, isValid },
    } = useForm<ItemFormData>({
        resolver: zodResolver(shoppingListItemInputSchema),
        mode: "onChange",
        defaultValues: {
            storeId: storeId,
            name: "",
            qty: null,
            notes: null,
            aisleId: null,
            sectionId: null,
            isIdea: false,
            isUnsure: false,
            isPrivate: false,
            snoozedUntil: null,
        },
    });

    // Watch form values
    const currentNotes = watch("notes");
    const currentName = watch("name");
    const isIdea = watch("isIdea");

    // Reset form when modal opens/closes or editing item changes
    useEffect(() => {
        if (isItemModalOpen && editingItem) {
            reset({
                storeId: effectiveStoreId,
                name: editingItem.itemName || "",
                qty: editingItem.qty,
                unitId: editingItem.unitId,
                notes: editingItem.notes,
                aisleId: editingItem.aisleId,
                sectionId: editingItem.sectionId,
                isIdea: editingItem.isIdea,
                isUnsure: editingItem.isUnsure ?? false,
                isPrivate: editingItem.isPrivate ?? false,
                // Clear snoozedUntil if item is checked (checked items cannot be snoozed) or if date is in the past
                snoozedUntil:
                    editingItem.isChecked || !isCurrentlySnoozed(editingItem.snoozedUntil)
                        ? null
                        : editingItem.snoozedUntil,
            });
        } else if (isItemModalOpen) {
            reset({
                storeId,
                name: "",
                qty: null,
                unitId: null,
                notes: null,
                aisleId: null,
                sectionId: null,
                isIdea: false,
                isUnsure: false,
                isPrivate: false,
                snoozedUntil: null,
            });
        }
    }, [isItemModalOpen, editingItem, reset, storeId, effectiveStoreId]);

    // Handle mode toggle - transfer notes between modes
    const handleModeToggle = (newMode: boolean) => {
        setValue("isIdea", newMode);

        if (newMode) {
            // Switching to Idea mode: transfer name to notes
            if (currentName && !currentNotes) {
                setValue("notes", currentName);
                setValue("name", "");
            }
        } else {
            // Switching to Item mode: transfer notes to name if name is empty
            if (currentNotes && !currentName) {
                setValue("name", currentNotes);
                setValue("notes", null);
            }
        }
    };

    const onSubmit = async (data: ItemFormData) => {
        // Defensive check: clear snoozedUntil if item is checked (checked items cannot be snoozed) or if date is in the past
        const shouldClearSnooze =
            editingItem?.isChecked || (data.snoozedUntil && !isCurrentlySnoozed(data.snoozedUntil));
        const snoozedUntil = shouldClearSnooze ? null : data.snoozedUntil || null;

        if (isIdea) {
            // Idea - no store item needed
            await upsertItem.mutateAsync({
                id: editingItem?.id,
                storeId: effectiveStoreId,
                storeItemId: null,
                notes: data.notes || null,
                isIdea: true,
                isUnsure: data.isUnsure ?? false,
                isPrivate: data.isPrivate ?? false,
                snoozedUntil,
            });
        } else {
            // Regular item - need store item
            let storeItemId: string;

            if (editingItem) {
                // Update existing store item. If the new name collides with another item in
                // this store, the backend merges into it and returns that item's id instead.
                const updatedStoreItem = await updateItem.mutateAsync({
                    id: editingItem.storeItemId!,
                    name: data.name || "",
                    aisleId: data.aisleId || null,
                    sectionId: data.sectionId || null,
                    storeId: effectiveStoreId,
                });
                storeItemId = updatedStoreItem!.id;
            } else {
                // Get or create store item
                const storeItem = await getOrCreateStoreItem.mutateAsync({
                    storeId: effectiveStoreId,
                    name: data.name || "",
                    aisleId: data.aisleId || null,
                    sectionId: data.sectionId || null,
                });
                storeItemId = storeItem.id;
            }

            // Update or create shopping list item
            await upsertItem.mutateAsync({
                id: editingItem?.id,
                storeId: effectiveStoreId,
                storeItemId: storeItemId,
                qty: data.qty ?? null,
                unitId: data.unitId || null,
                notes: data.notes || null,
                isUnsure: data.isUnsure ?? false,
                isPrivate: data.isPrivate ?? false,
                snoozedUntil,
            });
        }
        closeItemModal();
    };

    const handleDelete = async () => {
        if (!editingItem) return;

        try {
            await deleteItem.mutateAsync({
                id: editingItem.id,
                storeId: effectiveStoreId,
            });
            setShowDeleteAlert(false);
            closeItemModal();
        } catch (error) {
            console.error("Error deleting shopping list item:", error);
        }
    };

    return (
        <IonModal
            isOpen={isItemModalOpen}
            onDidDismiss={closeItemModal}
            onDidPresent={() => !editingItem && nameInputRef.current?.setFocus()}
        >
            <ModalHeader
                title={
                    editingItem
                        ? isIdea
                            ? "Edit Idea"
                            : "Edit Item"
                        : isIdea
                          ? "Add Idea"
                          : "Add Item"
                }
                onClose={closeItemModal}
                actions={
                    editingItem && (
                        <IonButton
                            onClick={() => setIsInfoOpen(true)}
                            aria-label={isIdea ? "Idea info" : "Item info"}
                        >
                            <IonIcon slot="icon-only" icon={informationCircleOutline} />
                        </IonButton>
                    )
                }
            />
            <IonContent className="ion-padding">
                {/* Mode switch - only for new items. A segmented control spanning the form's
                    width, so it reads as "what kind of thing is this" rather than as two tags. */}
                {!editingItem && (
                    <IonSegment
                        className="editor-mode-switch"
                        value={isIdea ? "idea" : "item"}
                        onIonChange={(e) => handleModeToggle(e.detail.value === "idea")}
                    >
                        <IonSegmentButton value="item" layout="icon-start">
                            <IonIcon icon={cartOutline} />
                            <IonLabel>Item</IonLabel>
                        </IonSegmentButton>
                        <IonSegmentButton value="idea" layout="icon-start">
                            <IonIcon icon={bulbOutline} />
                            <IonLabel>Idea</IonLabel>
                        </IonSegmentButton>
                    </IonSegment>
                )}

                <ItemEditorProvider
                    storeId={effectiveStoreId}
                    control={control}
                    errors={errors}
                    setValue={setValue}
                    watch={watch}
                    nameInputRef={nameInputRef}
                >
                    <form className="editor-form" onSubmit={handleSubmit(onSubmit)}>
                        {isIdea ? (
                            // Idea mode - only notes and snooze date
                            <>
                                <NotesInput />
                                <div className="item-flags-row">
                                    <UnsureToggle />
                                    <PrivateToggle />
                                </div>
                                {/* Hide snooze selector if editing a checked idea */}
                                {!editingItem?.isChecked && <SnoozeDateSelector />}
                            </>
                        ) : (
                            // Regular Item mode - all fields
                            <>
                                <NameAutocomplete />
                                <NotesInput />
                                <QuantityAndUnitRow />
                                <LocationSelectors />
                                <div className="item-flags-row">
                                    <UnsureToggle />
                                    <PrivateToggle />
                                </div>
                                {/* Hide snooze selector if editing a checked item */}
                                {!editingItem?.isChecked && <SnoozeDateSelector />}
                            </>
                        )}

                        <SaveButton isValid={isValid} upsertItem={upsertItem} isIdea={!!isIdea} />
                    </form>
                </ItemEditorProvider>

                {editingItem && (
                    <DestructiveAction
                        onClick={() => setShowDeleteAlert(true)}
                        busy={deleteItem.isPending}
                    >
                        {isIdea ? "Delete idea" : "Delete item"}
                    </DestructiveAction>
                )}

                <IonAlert
                    isOpen={showDeleteAlert}
                    onDidDismiss={() => setShowDeleteAlert(false)}
                    header={`Delete ${isIdea ? "Idea" : "Item"}`}
                    message={`Permanently remove "${
                        editingItem?.itemName || editingItem?.notes
                    }" from your store and shopping list?`}
                    buttons={[
                        {
                            text: "Cancel",
                            role: "cancel",
                        },
                        {
                            text: "Delete",
                            role: "destructive",
                            handler: handleDelete,
                        },
                    ]}
                />
            </IonContent>
            {editingItem && (
                <ItemInfoModal
                    mode="shoppingListItem"
                    isOpen={isInfoOpen}
                    onClose={() => setIsInfoOpen(false)}
                    item={editingItem}
                />
            )}
        </IonModal>
    );
};

const SaveButton: React.FC<{
    isValid: boolean;
    upsertItem: UseMutationResult<ShoppingListItem, Error, ItemFormData>;
    isIdea: boolean | undefined;
}> = ({ isValid, upsertItem, isIdea }) => {
    const { editingItem } = useItemEditorContext();
    return (
        <IonButton
            className="editor-form__submit"
            expand="block"
            type="submit"
            disabled={!isValid || upsertItem.isPending}
        >
            {editingItem ? "Update" : "Add"}
            {isIdea ? " Idea" : " Item"}
        </IonButton>
    );
};
