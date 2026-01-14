import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonAlert,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { UseMutationResult } from "@tanstack/react-query";
import { bulbOutline, cartOutline, closeOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
    useDeleteShoppingListItem,
    useGetOrCreateStoreItem,
    useUpdateItem,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import {
    ShoppingListItem,
    ShoppingListItemOptionalId,
} from "../../models/Store";
import { ItemEditorProvider } from "./ItemEditorContext";
import { ItemFormData, itemFormSchema } from "./itemEditorSchema";
import { LocationSelectors } from "./LocationSelectors";
import { NameAutocomplete } from "./NameAutocomplete";
import { NotesInput } from "./NotesInput";
import { QuantityInput } from "./QuantityInput";
import { SnoozeDateSelector } from "./SnoozeDateSelector";
import { UnitSelector } from "./UnitSelector";
import { useShoppingListContext } from "./useShoppingListContext";

interface ItemEditorModalProps {
    storeId: string;
}

export const ItemEditorModal = ({ storeId }: ItemEditorModalProps) => {
    const { isItemModalOpen, editingItem, closeItemModal } =
        useShoppingListContext();
    const upsertItem = useUpsertShoppingListItem();
    const getOrCreateStoreItem = useGetOrCreateStoreItem();
    const updateItem = useUpdateItem();
    const deleteItem = useDeleteShoppingListItem();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    const {
        control,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors, isValid },
    } = useForm<ItemFormData>({
        resolver: zodResolver(itemFormSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            qty: null,
            notes: null,
            aisleId: null,
            sectionId: null,
            isIdea: false,
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
                name: editingItem.item_name || "",
                qty: editingItem.qty,
                unitId: editingItem.unit_id,
                notes: editingItem.notes,
                aisleId: editingItem.aisle_id,
                sectionId: editingItem.section_id,
                isIdea: editingItem.is_idea === 1,
                // Clear snoozedUntil if item is checked (checked items cannot be snoozed)
                snoozedUntil:
                    editingItem.is_checked === 1
                        ? null
                        : editingItem.snoozed_until,
            });
        } else if (isItemModalOpen) {
            reset({
                name: "",
                qty: null,
                unitId: null,
                notes: null,
                aisleId: null,
                sectionId: null,
                isIdea: false,
                snoozedUntil: null,
            });
        }
    }, [isItemModalOpen, editingItem, reset]);

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
        // Defensive check: clear snoozedUntil if item is checked (checked items cannot be snoozed)
        const snoozedUntil =
            editingItem?.is_checked === 1 ? null : data.snoozedUntil || null;

        if (isIdea) {
            // Idea - no store item needed
            await upsertItem.mutateAsync({
                id: editingItem?.id,
                store_id: storeId,
                store_item_id: null,
                qty: null,
                unit_id: null,
                notes: data.notes || null,
                is_idea: 1,
                snoozed_until: snoozedUntil,
            });
        } else {
            // Regular item - need store item
            let storeItemId: string;

            if (editingItem) {
                // Update existing store item
                await updateItem.mutateAsync({
                    id: editingItem.store_item_id!,
                    name: data.name,
                    aisleId: data.aisleId || null,
                    sectionId: data.sectionId || null,
                    storeId,
                });
                storeItemId = editingItem.store_item_id!;
            } else {
                // Get or create store item
                const storeItem = await getOrCreateStoreItem.mutateAsync({
                    storeId,
                    name: data.name,
                    aisleId: data.aisleId || null,
                    sectionId: data.sectionId || null,
                });
                storeItemId = storeItem.id;
            }

            // Update or create shopping list item
            await upsertItem.mutateAsync({
                id: editingItem?.id,
                store_id: storeId,
                store_item_id: storeItemId,
                qty: data.qty ?? null,
                unit_id: data.unitId || null,
                notes: data.notes || null,
                is_idea: 0,
                snoozed_until: snoozedUntil,
            });
        }
        closeItemModal();
    };

    const handleDelete = async () => {
        if (!editingItem) return;

        try {
            await deleteItem.mutateAsync({
                id: editingItem.id,
                storeId: storeId,
            });
            setShowDeleteAlert(false);
            closeItemModal();
        } catch (error) {
            console.error("Error deleting shopping list item:", error);
        }
    };

    return (
        <IonModal isOpen={isItemModalOpen} onDidDismiss={closeItemModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>
                        {editingItem
                            ? isIdea
                                ? "Edit Idea"
                                : "Edit Item"
                            : isIdea
                            ? "Add Idea"
                            : "Add Item"}
                    </IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeItemModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                {/* Mode Toggle - only show for new items */}
                {!editingItem && (
                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            marginBottom: "16px",
                            justifyContent: "center",
                        }}
                    >
                        <IonChip
                            onClick={() => handleModeToggle(false)}
                            color={!isIdea ? "primary" : "medium"}
                            style={{
                                cursor: "pointer",
                                opacity: !isIdea ? 1 : 0.6,
                            }}
                        >
                            <IonIcon icon={cartOutline} />
                            <IonLabel>Item</IonLabel>
                        </IonChip>
                        <IonChip
                            onClick={() => handleModeToggle(true)}
                            color={isIdea ? "primary" : "medium"}
                            style={{
                                cursor: "pointer",
                                opacity: isIdea ? 1 : 0.6,
                            }}
                        >
                            <IonIcon icon={bulbOutline} />
                            <IonLabel>Idea</IonLabel>
                        </IonChip>
                    </div>
                )}

                <ItemEditorProvider
                    storeId={storeId}
                    control={control}
                    errors={errors}
                    setValue={setValue}
                    watch={watch}
                >
                    <form onSubmit={handleSubmit(onSubmit)}>
                        {isIdea ? (
                            // Idea mode - only notes and snooze date
                            <>
                                <NotesInput />
                                {/* Hide snooze selector if editing a checked idea */}
                                {editingItem?.is_checked !== 1 && (
                                    <SnoozeDateSelector />
                                )}
                            </>
                        ) : (
                            // Regular Item mode - all fields
                            <>
                                <NameAutocomplete />
                                <QuantityInput />
                                <UnitSelector />
                                <LocationSelectors />
                                <NotesInput />
                                {/* Hide snooze selector if editing a checked item */}
                                {editingItem?.is_checked !== 1 && (
                                    <SnoozeDateSelector />
                                )}
                            </>
                        )}

                        <SaveButton
                            isValid={isValid}
                            upsertItem={upsertItem}
                            editingItem={editingItem}
                            isIdea={isIdea}
                        />

                        {editingItem && (
                            <IonButton
                                expand="block"
                                color="danger"
                                fill="outline"
                                onClick={() => setShowDeleteAlert(true)}
                                disabled={deleteItem.isPending}
                                style={{ marginTop: "10px" }}
                            >
                                Delete {isIdea ? "Idea" : "Item"}
                            </IonButton>
                        )}
                    </form>
                </ItemEditorProvider>

                <IonAlert
                    isOpen={showDeleteAlert}
                    onDidDismiss={() => setShowDeleteAlert(false)}
                    header={`Remove ${isIdea ? "Idea" : "Item"}`}
                    message={`Permanently remove "${
                        editingItem?.item_name || editingItem?.notes
                    }" from your store and shopping list?`}
                    buttons={[
                        {
                            text: "Cancel",
                            role: "cancel",
                        },
                        {
                            text: "Remove",
                            role: "destructive",
                            handler: handleDelete,
                        },
                    ]}
                />
            </IonContent>
        </IonModal>
    );
};

const SaveButton: React.FC<{
    isValid: boolean;
    upsertItem: UseMutationResult<
        ShoppingListItem,
        Error,
        ShoppingListItemOptionalId
    >;
    editingItem: ShoppingListItem | null;
    isIdea: boolean | undefined;
}> = ({ isValid, upsertItem, editingItem, isIdea }) => {
    return (
        <IonButton
            expand="block"
            type="submit"
            disabled={!isValid || upsertItem.isPending}
            style={{ marginTop: "20px" }}
        >
            {editingItem ? "Update" : "Add"}
            {isIdea ? " Idea" : " Item"}
        </IonButton>
    );
};
