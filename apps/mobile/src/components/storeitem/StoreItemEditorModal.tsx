import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller } from "react-hook-form";
import { StoreItemEditorProvider } from "./StoreItemEditorProvider";
import { ItemNameAndLocationFields } from "../shared/ItemNameAndLocationFields";
import {
    storeItemEditorSchema,
    StoreItemFormData,
} from "./storeItemEditorSchema";
import { useCreateItem, useDeleteItem, useUpdateItem } from "../../db/hooks";
import { StoreItem } from "../../db/types";
import { useEffect, useState } from "react";

interface StoreItemEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
    editingItem: StoreItem | null;
}

export const StoreItemEditorModal: React.FC<StoreItemEditorModalProps> = ({
    isOpen,
    onClose,
    storeId,
    editingItem,
}) => {
    const createItem = useCreateItem();
    const updateItem = useUpdateItem();
    const deleteItem = useDeleteItem();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    const form = useForm<StoreItemFormData>({
        resolver: zodResolver(storeItemEditorSchema),
        mode: "onChange",
        defaultValues: {
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
                    name: editingItem.name,
                    aisleId: editingItem.aisle_id,
                    sectionId: editingItem.section_id,
                });
            } else {
                reset({
                    name: "",
                    aisleId: null,
                    sectionId: null,
                });
            }
        }
    }, [isOpen, editingItem, reset]);

    const onSubmit = async (data: StoreItemFormData) => {
        try {
            if (editingItem) {
                await updateItem.mutateAsync({
                    id: editingItem.id,
                    name: data.name,
                    aisleId: data.aisleId ?? null,
                    sectionId: data.sectionId ?? null,
                    storeId: storeId,
                });
            } else {
                await createItem.mutateAsync({
                    storeId,
                    name: data.name,
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
        setShowDeleteAlert(false);
        onClose();
    };

    const handleDelete = async () => {
        if (!editingItem) return;

        try {
            await deleteItem.mutateAsync({
                id: editingItem.id,
                storeId: storeId,
            });
            setShowDeleteAlert(false);
            onClose();
        } catch (error) {
            console.error("Error deleting store item:", error);
        }
    };

    const isPending =
        createItem.isPending || updateItem.isPending || deleteItem.isPending;

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>
                        {editingItem ? "Edit Item" : "Add Item"}
                    </IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose} disabled={isPending}>
                            Cancel
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <StoreItemEditorProvider form={form} storeId={storeId}>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <ItemNameAndLocationFields
                            control={control}
                            setValue={form.setValue}
                            watch={form.watch}
                            errors={errors}
                            storeId={storeId}
                            disabled={isPending}
                            renderNameField={({ control }) => (
                                <Controller
                                    name="name"
                                    control={control}
                                    render={({ field }) => (
                                        <>
                                            <IonItem>
                                                <IonLabel position="stacked">
                                                    Item Name
                                                </IonLabel>
                                                <IonInput
                                                    value={field.value}
                                                    placeholder="Enter item name"
                                                    onIonInput={(e) =>
                                                        field.onChange(
                                                            e.detail.value
                                                        )
                                                    }
                                                    disabled={isPending}
                                                />
                                            </IonItem>
                                            {errors.name && (
                                                <IonText color="danger">
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            marginLeft: "16px",
                                                        }}
                                                    >
                                                        {errors.name.message}
                                                    </p>
                                                </IonText>
                                            )}
                                        </>
                                    )}
                                />
                            )}
                        />

                        <IonButton
                            expand="block"
                            type="submit"
                            disabled={!isValid || isPending}
                            style={{ marginTop: "20px" }}
                        >
                            {editingItem ? "Update" : "Add"} Item
                        </IonButton>

                        {editingItem && (
                            <IonButton
                                expand="block"
                                color="danger"
                                fill="outline"
                                onClick={() => setShowDeleteAlert(true)}
                                disabled={isPending}
                                style={{ marginTop: "10px" }}
                            >
                                Delete Item
                            </IonButton>
                        )}
                    </form>
                </StoreItemEditorProvider>

                <IonAlert
                    isOpen={showDeleteAlert}
                    onDidDismiss={() => setShowDeleteAlert(false)}
                    header="Delete Item"
                    message={`Are you sure you want to delete "${editingItem?.name}"? This will remove it from all shopping lists.`}
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
        </IonModal>
    );
};
