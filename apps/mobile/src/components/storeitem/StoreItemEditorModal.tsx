import {
    storeItemInputSchema,
    type StoreItemFormData,
    type StoreItemWithDetails,
} from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonIcon, IonInput, IonModal, useIonAlert } from "@ionic/react";
import { informationCircleOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCreateItem, useDeleteItem, useUpdateItem } from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { DestructiveAction } from "../shared/DestructiveAction";
import { FormField } from "../shared/FormField";
import ItemInfoModal from "../shared/ItemInfoModal";
import { ItemNameAndLocationFields } from "../shared/ItemNameAndLocationFields";
import { ModalHeader } from "../shared/ModalHeader";

interface StoreItemEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDismissed?: () => void;
    storeId: string;
    editingItem: StoreItemWithDetails | null;
}

export const StoreItemEditorModal: React.FC<StoreItemEditorModalProps> = ({
    isOpen,
    onClose,
    onDismissed,
    storeId,
    editingItem,
}) => {
    const createItem = useCreateItem();
    const updateItem = useUpdateItem();
    const deleteItem = useDeleteItem();
    const [presentAlert] = useIonAlert();
    const { showSuccess } = useToast();
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const nameInputRef = useRef<HTMLIonInputElement>(null);

    const form = useForm<StoreItemFormData>({
        resolver: zodResolver(storeItemInputSchema),
        mode: "onChange",
        defaultValues: {
            storeId,
            name: "",
            aisleId: null,
            sectionId: null,
        },
    });

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = form;

    // Reset form when modal opens or editing item changes
    useEffect(() => {
        if (isOpen) {
            if (editingItem) {
                reset({
                    storeId,
                    name: editingItem.name,
                    aisleId: editingItem.aisleId,
                    sectionId: editingItem.sectionId,
                });
            } else {
                reset({
                    storeId,
                    name: "",
                    aisleId: null,
                    sectionId: null,
                });
            }
        }
    }, [isOpen, editingItem, reset, storeId]);

    const onSubmit = async (data: StoreItemFormData) => {
        try {
            if (editingItem) {
                await updateItem.mutateAsync({
                    id: editingItem.id,
                    name: data.name || "",
                    aisleId: data.aisleId ?? null,
                    sectionId: data.sectionId ?? null,
                    storeId: storeId,
                });
            } else {
                await createItem.mutateAsync({
                    storeId,
                    name: data.name || "",
                    aisleId: data.aisleId ?? null,
                    sectionId: data.sectionId ?? null,
                });
            }
            onClose();
        } catch (error) {
            console.error("Error saving store item:", error);
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleDismiss = () => {
        handleClose();
        onDismissed?.();
    };

    const confirmDelete = () => {
        presentAlert({
            header: "Delete Item",
            message: `Are you sure you want to delete "${editingItem?.name}"? This will remove it from all shopping lists.`,
            buttons: [
                { text: "Cancel", role: "cancel" },
                {
                    text: "Delete",
                    role: "destructive",
                    handler: async () => {
                        if (editingItem) {
                            await deleteItem.mutateAsync({ id: editingItem.id, storeId });
                            onClose();
                        }
                    },
                },
            ],
        });
    };

    const isPending = createItem.isPending || updateItem.isPending || deleteItem.isPending;

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleDismiss}
            onDidPresent={() => !editingItem && nameInputRef.current?.setFocus()}
        >
            <ModalHeader
                title={editingItem ? "Edit Item" : "Add Item"}
                onClose={handleClose}
                closeDisabled={isPending}
                actions={
                    editingItem && (
                        <IonButton
                            onClick={() => setIsInfoOpen(true)}
                            disabled={isPending}
                            aria-label="Item info"
                        >
                            <IonIcon slot="icon-only" icon={informationCircleOutline} />
                        </IonButton>
                    )
                }
            />
            <IonContent className="ion-padding">
                <form className="editor-form" onSubmit={handleSubmit(onSubmit)}>
                    <ItemNameAndLocationFields
                        control={control}
                        setValue={form.setValue}
                        watch={form.watch}
                        errors={errors}
                        storeId={storeId}
                        disabled={isPending}
                        // Only in create mode: this form's create path is `useCreateItem`,
                        // which rejects a colliding name rather than merging, so the default
                        // rename-onto-the-existing-name would dead-end in a conflict. Editing
                        // saves through `useUpdateItem`, which merges, so it keeps the default.
                        onUseExistingItem={
                            editingItem
                                ? undefined
                                : (match) => {
                                      showSuccess(`"${match.existing.name}" is already here`);
                                      onClose();
                                  }
                        }
                        renderNameField={({ control }) => (
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <FormField label="Item" error={errors.name?.message}>
                                        <div className="form-control">
                                            <IonInput
                                                ref={nameInputRef}
                                                aria-label="Item"
                                                value={field.value}
                                                placeholder="Enter item name"
                                                autocapitalize="sentences"
                                                onIonInput={(e) => field.onChange(e.detail.value)}
                                                disabled={isPending}
                                            />
                                        </div>
                                    </FormField>
                                )}
                            />
                        )}
                    />

                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        type="submit"
                        disabled={!isValid || isPending}
                    >
                        {editingItem ? "Update" : "Add"} Item
                    </IonButton>
                </form>

                {editingItem && (
                    <DestructiveAction onClick={confirmDelete} disabled={isPending}>
                        Delete item
                    </DestructiveAction>
                )}
            </IonContent>
            {editingItem !== null && (
                <ItemInfoModal
                    mode="storeItem"
                    isOpen={isInfoOpen}
                    onClose={() => setIsInfoOpen(false)}
                    item={editingItem}
                />
            )}
        </IonModal>
    );
};
