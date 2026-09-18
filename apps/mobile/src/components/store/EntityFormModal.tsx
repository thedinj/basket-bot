import { isSingleEmoji } from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonLabel,
    IonModal,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeCircle, closeOutline, trash } from "ionicons/icons";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
    useCreateAisle,
    useCreateSection,
    useDeleteAisle,
    useDeleteSection,
    useStoreAisles,
    useUpdateAisle,
    useUpdateSection,
} from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { canSuggestEmojiFor } from "../../llm/features/aisleEmoji";
import { useSuggestAisleEmoji } from "../../llm/features/useSuggestAisleEmoji";
import { LLM_ICON_SRC } from "../../llm/shared/constants";
import { parseAisleName } from "../../utils/aisleName";
import { formatErrorMessage } from "../../utils/errorUtils";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import type { SelectableItem } from "../shared/ClickableSelectionModal";
import { FormField } from "../shared/FormField";
import { useStoreManagement } from "./StoreManagementContext";

const entityFormSchema = z
    .object({
        name: z
            .string()
            .min(1, "Name is required")
            .transform((val) => val.trim()),
        type: z.enum(["aisle", "section"]),
        aisleId: z.string().optional(),
        // Aisles only. Blank means none.
        emoji: z
            .string()
            .optional()
            .refine((val) => !val?.trim() || isSingleEmoji(val), "Use a single emoji"),
    })
    .refine(
        (data) => {
            if (data.type === "section") {
                return !!data.aisleId;
            }
            return true;
        },
        {
            message: "Aisle is required for sections",
            path: ["aisleId"],
        }
    );

type EntityFormData = z.infer<typeof entityFormSchema>;

export const EntityFormModal = () => {
    const { storeId, isModalOpen, editingEntity, forcedType, closeModal } = useStoreManagement();
    const { data: aisles } = useStoreAisles(storeId);
    const createAisle = useCreateAisle();
    const updateAisle = useUpdateAisle();
    const createSection = useCreateSection();
    const updateSection = useUpdateSection();
    const deleteAisle = useDeleteAisle();
    const deleteSection = useDeleteSection();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    const { suggestForName } = useSuggestAisleEmoji();
    const { showError } = useToast();

    const {
        control,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isValid },
    } = useForm<EntityFormData>({
        resolver: zodResolver(entityFormSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            type: "aisle",
            aisleId: undefined,
        },
    });

    const entityType = watch("type");
    // What the plate shows with no emoji, so the field's placeholder describes this aisle:
    // a numbered aisle falls back to its number, a named one to an empty plate.
    const aisleName = watch("name") ?? "";
    const emojiPlaceholder = parseAisleName(aisleName).code
        ? "None (shows the aisle number)"
        : "None (plate stays empty)";

    // One-off suggestion for this aisle's current name. Fills the field only; nothing is saved
    // until Update, and it asks even if an emoji is already set, since the user asked.
    const [isSuggesting, setIsSuggesting] = useState(false);
    const handleSuggestEmoji = async () => {
        setIsSuggesting(true);
        try {
            const emoji = await suggestForName(aisleName);
            if (emoji) {
                setValue("emoji", emoji, { shouldDirty: true, shouldValidate: true });
            } else {
                showError("No emoji fits that name. Pick one from the keyboard.");
            }
        } catch (error) {
            showError(formatErrorMessage(error, "suggest an emoji"));
        } finally {
            setIsSuggesting(false);
        }
    };

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
                aisleId:
                    editingEntity.type === "section"
                        ? editingEntity.aisleId || undefined
                        : undefined,
                emoji: editingEntity.emoji ?? "",
            });
        } else if (isModalOpen && !editingEntity) {
            const initialType = forcedType || "aisle";
            reset({ name: "", type: initialType, aisleId: undefined, emoji: "" });
        }
    }, [isModalOpen, editingEntity, forcedType, reset]);

    const onSubmit = async (data: EntityFormData) => {
        if (data.type === "aisle") {
            const emoji = data.emoji?.trim() || null;
            if (editingEntity) {
                await updateAisle.mutateAsync({
                    id: editingEntity.id,
                    name: data.name,
                    emoji,
                    storeId,
                });
            } else {
                await createAisle.mutateAsync({ storeId, name: data.name, emoji });
            }
        } else {
            if (!data.aisleId) {
                throw new Error("Aisle is required for sections");
            }
            if (editingEntity) {
                await updateSection.mutateAsync({
                    id: editingEntity.id,
                    name: data.name,
                    aisleId: data.aisleId,
                    storeId,
                });
            } else {
                await createSection.mutateAsync({
                    storeId,
                    name: data.name,
                    aisleId: data.aisleId,
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
            return `Edit ${editingEntity.type === "aisle" ? "Aisle" : "Section"}`;
        }
        if (forcedType === "aisle") {
            return "New Aisle";
        }
        if (forcedType === "section") {
            return "New Section";
        }
        return aisles && aisles.length > 0 ? "New Aisle or Section" : "New Aisle";
    };

    const showTypeSelector = !editingEntity && !forcedType && aisles && aisles.length > 0;

    return (
        <IonModal isOpen={isModalOpen} onDidDismiss={closeModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{getModalTitle()}</IonTitle>
                    <IonButtons slot="end">
                        {editingEntity && (
                            <IonButton
                                onClick={() => setShowDeleteAlert(true)}
                                disabled={deleteAisle.isPending || deleteSection.isPending}
                            >
                                <IonIcon slot="icon-only" icon={trash} />
                            </IonButton>
                        )}
                        <IonButton onClick={closeModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <form className="editor-form" onSubmit={handleSubmit(onSubmit)}>
                    {showTypeSelector && (
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <IonSegment
                                    className="editor-mode-switch"
                                    value={field.value}
                                    onIonChange={(e) => field.onChange(e.detail.value)}
                                >
                                    <IonSegmentButton value="aisle">
                                        <IonLabel>Aisle</IonLabel>
                                    </IonSegmentButton>
                                    <IonSegmentButton value="section">
                                        <IonLabel>Section</IonLabel>
                                    </IonSegmentButton>
                                </IonSegment>
                            )}
                        />
                    )}

                    {entityType === "section" && (
                        <Controller
                            name="aisleId"
                            control={control}
                            render={({ field }) => (
                                <FormField label="Aisle" error={errors.aisleId?.message}>
                                    <div className="form-control">
                                        <ClickableSelectionField
                                            items={aisleItems}
                                            value={field.value}
                                            onSelect={field.onChange}
                                            placeholder="Select an aisle"
                                            modalTitle="Select Aisle"
                                            showSearch={true}
                                            searchPlaceholder="Search aisles..."
                                            lines="none"
                                            showChevron
                                        />
                                    </div>
                                </FormField>
                            )}
                        />
                    )}

                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <FormField label="Name" error={errors.name?.message}>
                                <div className="form-control">
                                    <IonInput
                                        aria-label="Name"
                                        value={field.value}
                                        placeholder={`Enter ${
                                            entityType === "aisle" ? "aisle" : "section"
                                        } name`}
                                        onIonInput={(e) => field.onChange(e.detail.value)}
                                        autocapitalize="sentences"
                                    />
                                </div>
                            </FormField>
                        )}
                    />

                    {entityType === "aisle" && (
                        <Controller
                            name="emoji"
                            control={control}
                            render={({ field }) => (
                                <FormField
                                    label="Emoji"
                                    error={errors.emoji?.message}
                                    action={
                                        <button
                                            type="button"
                                            className="form-field__action"
                                            disabled={
                                                isSuggesting || !canSuggestEmojiFor(aisleName)
                                            }
                                            onClick={handleSuggestEmoji}
                                            title="Suggest an emoji for this aisle's name"
                                        >
                                            <IonIcon src={LLM_ICON_SRC} aria-hidden="true" />
                                            Suggest
                                        </button>
                                    }
                                >
                                    <div className="form-control entity-emoji">
                                        <IonInput
                                            aria-label="Emoji"
                                            className="entity-emoji__input"
                                            value={field.value}
                                            placeholder={emojiPlaceholder}
                                            onIonInput={(e) => field.onChange(e.detail.value ?? "")}
                                        />
                                        {!!field.value && (
                                            <button
                                                type="button"
                                                className="entity-emoji__clear"
                                                aria-label="Clear emoji"
                                                onClick={() => field.onChange("")}
                                            >
                                                <IonIcon icon={closeCircle} />
                                            </button>
                                        )}
                                    </div>
                                </FormField>
                            )}
                        />
                    )}

                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        type="submit"
                        disabled={
                            !isValid ||
                            createAisle.isPending ||
                            updateAisle.isPending ||
                            createSection.isPending ||
                            updateSection.isPending
                        }
                    >
                        {editingEntity ? "Update" : "Create"}
                    </IonButton>
                </form>

                <IonAlert
                    isOpen={showDeleteAlert}
                    onDidDismiss={() => setShowDeleteAlert(false)}
                    header={`Delete ${editingEntity?.type === "aisle" ? "Aisle" : "Section"}`}
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
