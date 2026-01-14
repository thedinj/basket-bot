import {
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonText,
    IonAlert,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { Controller, useForm } from "react-hook-form";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import type { SelectableItem } from "../shared/ClickableSelectionModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useMemo } from "react";
import { useStoreManagement } from "./StoreManagementContext";
import {
    useCreateAisle,
    useUpdateAisle,
    useCreateSection,
    useUpdateSection,
    useDeleteAisle,
    useDeleteSection,
} from "../../db/hooks";

const entityFormSchema = z
    .object({
        name: z
            .string()
            .min(1, "Name is required")
            .transform((val) => val.trim()),
        type: z.enum(["aisle", "section"]),
        aisle_id: z.string().optional(),
    })
    .refine(
        (data) => {
            if (data.type === "section") {
                return !!data.aisle_id;
            }
            return true;
        },
        {
            message: "Aisle is required for sections",
            path: ["aisle_id"],
        }
    );

type EntityFormData = z.infer<typeof entityFormSchema>;

interface EntityFormModalProps {
    storeId: string;
    aisles: Array<{ id: string; name: string }> | undefined;
}

export const EntityFormModal = ({ storeId, aisles }: EntityFormModalProps) => {
    const { isModalOpen, editingEntity, forcedType, closeModal } =
        useStoreManagement();
    const createAisle = useCreateAisle();
    const updateAisle = useUpdateAisle();
    const createSection = useCreateSection();
    const updateSection = useUpdateSection();
    const deleteAisle = useDeleteAisle();
    const deleteSection = useDeleteSection();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isValid },
    } = useForm<EntityFormData>({
        resolver: zodResolver(entityFormSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            type: "aisle",
            aisle_id: undefined,
        },
    });

    const entityType = watch("type");

    const aisleItems: SelectableItem[] = useMemo(() => {
        return (
            aisles?.map((aisle) => ({
                id: aisle.id,
                label: aisle.name,
            })) || []
        );
    }, [aisles]);

    // Reset form when modal opens/closes or editing entity changes
    useEffect(() => {
        if (isModalOpen && editingEntity) {
            reset({
                name: editingEntity.name,
                type: editingEntity.type,
                aisle_id:
                    editingEntity.type === "section"
                        ? editingEntity.aisle_id || undefined
                        : undefined,
            });
        } else if (isModalOpen && !editingEntity) {
            const initialType = forcedType || "aisle";
            reset({ name: "", type: initialType, aisle_id: undefined });
        }
    }, [isModalOpen, editingEntity, forcedType, reset]);

    const onSubmit = async (data: EntityFormData) => {
        if (data.type === "aisle") {
            if (editingEntity) {
                await updateAisle.mutateAsync({
                    id: editingEntity.id,
                    name: data.name,
                    storeId,
                });
            } else {
                await createAisle.mutateAsync({ storeId, name: data.name });
            }
        } else {
            if (!data.aisle_id) {
                throw new Error("Aisle is required for sections");
            }
            if (editingEntity) {
                await updateSection.mutateAsync({
                    id: editingEntity.id,
                    name: data.name,
                    aisleId: data.aisle_id,
                    storeId,
                });
            } else {
                await createSection.mutateAsync({
                    storeId,
                    name: data.name,
                    aisleId: data.aisle_id,
                });
            }
        }
        closeModal();
    };

    const handleDelete = async () => {
        if (!editingEntity) return;

        try {
            if (editingEntity.type === "aisle") {
                await deleteAisle.mutateAsync({
                    id: editingEntity.id,
                    storeId,
                });
            } else {
                await deleteSection.mutateAsync({
                    id: editingEntity.id,
                    storeId,
                });
            }
            setShowDeleteAlert(false);
            closeModal();
        } catch (error) {
            console.error("Error deleting entity:", error);
        }
    };

    const getModalTitle = () => {
        if (editingEntity) {
            return `Edit ${
                editingEntity.type === "aisle" ? "Aisle" : "Section"
            }`;
        }
        if (forcedType === "aisle") {
            return "New Aisle";
        }
        if (forcedType === "section") {
            return "New Section";
        }
        return aisles && aisles.length > 0
            ? "New Aisle or Section"
            : "New Aisle";
    };

    const showTypeSelector =
        !editingEntity && !forcedType && aisles && aisles.length > 0;

    return (
        <IonModal isOpen={isModalOpen} onDidDismiss={closeModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{getModalTitle()}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form onSubmit={handleSubmit(onSubmit)}>
                    {showTypeSelector && (
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <div style={{ marginBottom: "16px" }}>
                                    <IonLabel
                                        style={{
                                            display: "block",
                                            marginBottom: "8px",
                                            fontSize: "14px",
                                            marginLeft: "16px",
                                        }}
                                    >
                                        Type
                                    </IonLabel>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "8px",
                                            paddingLeft: "16px",
                                            paddingRight: "16px",
                                        }}
                                    >
                                        <IonButton
                                            expand="block"
                                            fill={
                                                field.value === "aisle"
                                                    ? "solid"
                                                    : "outline"
                                            }
                                            color="primary"
                                            onClick={() =>
                                                field.onChange("aisle")
                                            }
                                            style={{ flex: 1 }}
                                        >
                                            Aisle
                                        </IonButton>
                                        <IonButton
                                            expand="block"
                                            fill={
                                                field.value === "section"
                                                    ? "solid"
                                                    : "outline"
                                            }
                                            color="primary"
                                            onClick={() =>
                                                field.onChange("section")
                                            }
                                            style={{ flex: 1 }}
                                        >
                                            Section
                                        </IonButton>
                                    </div>
                                </div>
                            )}
                        />
                    )}

                    {entityType === "section" && (
                        <Controller
                            name="aisle_id"
                            control={control}
                            render={({ field }) => (
                                <ClickableSelectionField
                                    items={aisleItems}
                                    value={field.value}
                                    onSelect={field.onChange}
                                    label="Aisle"
                                    placeholder="Select an aisle"
                                    modalTitle="Select Aisle"
                                    showSearch={true}
                                    searchPlaceholder="Search aisles..."
                                    errorMessage={errors.aisle_id?.message}
                                />
                            )}
                        />
                    )}

                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <IonItem>
                                <IonLabel position="stacked">Name</IonLabel>
                                <IonInput
                                    value={field.value}
                                    placeholder={`Enter ${
                                        entityType === "aisle"
                                            ? "aisle"
                                            : "section"
                                    } name`}
                                    onIonInput={(e) =>
                                        field.onChange(e.detail.value)
                                    }
                                    autocapitalize="sentences"
                                />
                            </IonItem>
                        )}
                    />
                    {errors.name && (
                        <IonText color="danger">
                            <p style={{ fontSize: "12px", marginLeft: "16px" }}>
                                {errors.name.message}
                            </p>
                        </IonText>
                    )}

                    <IonButton
                        expand="block"
                        type="submit"
                        disabled={
                            !isValid ||
                            createAisle.isPending ||
                            updateAisle.isPending ||
                            createSection.isPending ||
                            updateSection.isPending
                        }
                        style={{ marginTop: "20px" }}
                    >
                        {editingEntity ? "Update" : "Create"}
                    </IonButton>

                    {editingEntity && (
                        <IonButton
                            expand="block"
                            color="danger"
                            fill="outline"
                            onClick={() => setShowDeleteAlert(true)}
                            disabled={
                                deleteAisle.isPending || deleteSection.isPending
                            }
                            style={{ marginTop: "10px" }}
                        >
                            Delete{" "}
                            {editingEntity.type === "aisle"
                                ? "Aisle"
                                : "Section"}
                        </IonButton>
                    )}
                </form>

                <IonAlert
                    isOpen={showDeleteAlert}
                    onDidDismiss={() => setShowDeleteAlert(false)}
                    header={`Delete ${
                        editingEntity?.type === "aisle" ? "Aisle" : "Section"
                    }`}
                    message={`Are you sure you want to delete "${
                        editingEntity?.name
                    }"? This will also affect ${
                        editingEntity?.type === "aisle"
                            ? "all sections in this aisle and items"
                            : "items"
                    } in this ${editingEntity?.type}.`}
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
