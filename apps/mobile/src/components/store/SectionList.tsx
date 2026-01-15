import { zodResolver } from "@hookform/resolvers/zod";
import { ItemReorderEventDetail } from "@ionic/core";
import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonModal,
    IonReorder,
    IonReorderGroup,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline, create, trash } from "ionicons/icons";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
    useCreateSection,
    useDeleteSection,
    useReorderSections,
    useStoreAisles,
    useStoreSections,
    useUpdateSection,
} from "../../db/hooks";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import type { SelectableItem } from "../shared/ClickableSelectionModal";
import { ListHandle } from "./types";

const sectionFormSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .transform((val) => val.trim()),
    aisleId: z.string().nullable().optional(),
});

type SectionFormData = z.infer<typeof sectionFormSchema>;

interface SectionListProps {
    storeId: string;
}

const SectionList = forwardRef<ListHandle, SectionListProps>(({ storeId }, ref) => {
    const { data: sections, isLoading } = useStoreSections(storeId);
    const { data: aisles } = useStoreAisles(storeId);
    const createSection = useCreateSection();
    const updateSection = useUpdateSection();
    const deleteSection = useDeleteSection();
    const reorderSections = useReorderSections();

    const aisleItems: SelectableItem[] = useMemo(() => {
        return (
            aisles?.map((aisle) => ({
                id: aisle.id,
                label: aisle.name,
            })) || []
        );
    }, [aisles]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSection, setEditingSection] = useState<{
        id: string;
        name: string;
        aisleId?: string | null;
    } | null>(null);
    const [deleteAlert, setDeleteAlert] = useState<{
        id: string;
        name: string;
    } | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = useForm<SectionFormData>({
        resolver: zodResolver(sectionFormSchema),
        mode: "onChange",
    });

    const openCreateModal = () => {
        setEditingSection(null);
        reset({ name: "", aisleId: null });
        setIsModalOpen(true);
    };

    useImperativeHandle(ref, () => ({
        openCreateModal,
    }));

    const openEditModal = (section: { id: string; name: string; aisleId?: string | null }) => {
        setEditingSection(section);
        reset({ name: section.name, aisleId: section.aisleId || null });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSection(null);
        reset({ name: "", aisleId: null });
    };

    const onSubmit = async (data: SectionFormData) => {
        if (editingSection) {
            // aisleId is required, so we must have a value
            if (!data.aisleId) {
                return;
            }
            await updateSection.mutateAsync({
                id: editingSection.id,
                name: data.name,
                aisleId: data.aisleId,
                storeId,
            });
        } else {
            // aisleId is required, so we must have a value
            if (!data.aisleId) {
                return;
            }
            await createSection.mutateAsync({
                storeId,
                name: data.name,
                aisleId: data.aisleId,
            });
        }
        closeModal();
    };

    const confirmDelete = (section: { id: string; name: string }) => {
        setDeleteAlert(section);
    };

    const handleDelete = async () => {
        if (deleteAlert) {
            await deleteSection.mutateAsync({
                id: deleteAlert.id,
                storeId,
            });
            setDeleteAlert(null);
        }
    };

    const handleReorder = async (event: CustomEvent<ItemReorderEventDetail>) => {
        if (!sections) return;

        const from = event.detail.from;
        const to = event.detail.to;

        const reordered = [...sections];
        const [movedItem] = reordered.splice(from, 1);
        reordered.splice(to, 0, movedItem);

        const updates = reordered.map((section, index) => ({
            id: section.id,
            sortOrder: index,
        }));

        await reorderSections.mutateAsync({ updates, storeId });

        event.detail.complete();
    };

    // Create aisle name map for display
    const aisleMap = new Map(aisles?.map((a) => [a.id, a.name]));

    if (isLoading) {
        return (
            <IonList>
                {[1, 2, 3].map((i) => (
                    <IonItem key={i}>
                        <IonLabel>
                            <IonSkeletonText animated style={{ width: "60%" }} />
                        </IonLabel>
                    </IonItem>
                ))}
            </IonList>
        );
    }

    if (!sections || sections.length === 0) {
        return (
            <div
                style={{
                    textAlign: "center",
                    marginTop: "40px",
                    padding: "20px",
                }}
            >
                <IonText color="medium">
                    <p>No sections yet. Tap the + button to add one.</p>
                </IonText>
            </div>
        );
    }

    return (
        <>
            <IonList>
                <IonReorderGroup disabled={false} onIonItemReorder={handleReorder}>
                    {sections.map((section) => (
                        <IonItemSliding key={section.id}>
                            <IonItem>
                                <IonLabel>
                                    <h2>{section.name}</h2>
                                    {section.aisleId && (
                                        <p>Aisle: {aisleMap.get(section.aisleId) || "Unknown"}</p>
                                    )}
                                </IonLabel>
                                <IonReorder slot="end" />
                            </IonItem>
                            <IonItemOptions side="end">
                                <IonItemOption
                                    color="primary"
                                    onClick={() => openEditModal(section)}
                                >
                                    <IonIcon slot="icon-only" icon={create} />
                                </IonItemOption>
                                <IonItemOption
                                    color="danger"
                                    onClick={() => confirmDelete(section)}
                                >
                                    <IonIcon slot="icon-only" icon={trash} />
                                </IonItemOption>
                            </IonItemOptions>
                        </IonItemSliding>
                    ))}
                </IonReorderGroup>
            </IonList>

            {/* Section Modal */}
            <IonModal isOpen={isModalOpen} onDidDismiss={closeModal}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>{editingSection ? "Edit Section" : "New Section"}</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={closeModal}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <IonItem>
                                    <IonLabel position="stacked">Section Name</IonLabel>
                                    <IonInput
                                        {...field}
                                        placeholder="Enter section name"
                                        onIonInput={(e) => field.onChange(e.detail.value)}
                                        autocapitalize="sentences"
                                    />
                                </IonItem>
                            )}
                        />
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

                        <Controller
                            name="aisleId"
                            control={control}
                            render={({ field }) => (
                                <ClickableSelectionField
                                    items={aisleItems}
                                    value={field.value}
                                    onSelect={field.onChange}
                                    label="Aisle"
                                    placeholder="None"
                                    modalTitle="Select Aisle"
                                    showSearch={true}
                                    searchPlaceholder="Search aisles..."
                                />
                            )}
                        />

                        <IonButton
                            expand="block"
                            type="submit"
                            disabled={
                                !isValid || createSection.isPending || updateSection.isPending
                            }
                            style={{ marginTop: "20px" }}
                        >
                            {editingSection ? "Update" : "Create"}
                        </IonButton>
                    </form>
                </IonContent>
            </IonModal>

            {/* Delete Alert */}
            <IonAlert
                isOpen={!!deleteAlert}
                onDidDismiss={() => setDeleteAlert(null)}
                header="Delete Section"
                message={`Are you sure you want to delete "${deleteAlert?.name}"? This will also affect items in this section.`}
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
        </>
    );
});

export default SectionList;
