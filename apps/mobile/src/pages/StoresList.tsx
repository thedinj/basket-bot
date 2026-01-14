import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonPage,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { add, closeOutline, storefrontOutline } from "ionicons/icons";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AppHeader } from "../components/layout/AppHeader";
import { FabSpacer } from "../components/shared/FabSpacer";
import { useCreateStore, useStores, useUpdateStore } from "../db/hooks";

const storeFormSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .transform((val) => val.trim()),
});

type StoreFormData = z.infer<typeof storeFormSchema>;

const StoresList: React.FC = () => {
    const { data: stores, isLoading } = useStores();
    const createStore = useCreateStore();
    const updateStore = useUpdateStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<{
        id: string;
        name: string;
    } | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = useForm<StoreFormData>({
        resolver: zodResolver(storeFormSchema),
        mode: "onChange",
    });

    const openCreateModal = () => {
        setEditingStore(null);
        reset({ name: "" });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingStore(null);
        reset({ name: "" });
    };

    const onSubmit = async (data: StoreFormData) => {
        if (editingStore) {
            await updateStore.mutateAsync({
                id: editingStore.id,
                name: data.name,
            });
        } else {
            await createStore.mutateAsync(data.name);
        }
        closeModal();
    };

    return (
        <IonPage>
            <AppHeader title="Stores" />
            <IonContent fullscreen>
                {isLoading ? (
                    <IonList>
                        {[1, 2, 3].map((i) => (
                            <IonItem key={i}>
                                <IonLabel>
                                    <IonSkeletonText
                                        animated
                                        style={{ width: "60%" }}
                                    />
                                </IonLabel>
                            </IonItem>
                        ))}
                    </IonList>
                ) : !stores?.length ? (
                    <div
                        style={{
                            textAlign: "center",
                            marginTop: "40px",
                            padding: "20px",
                        }}
                    >
                        <IonText color="medium">
                            <p>
                                No stores configured. Add one to begin
                                optimizing your shopping.
                            </p>
                        </IonText>
                    </div>
                ) : (
                    <IonList>
                        {stores.map((store) => (
                            <IonItem
                                key={store.id}
                                routerLink={`/stores/${store.id}`}
                                button
                                detail
                            >
                                <IonIcon
                                    icon={storefrontOutline}
                                    slot="start"
                                />
                                <IonLabel>
                                    <h2>{store.name}</h2>
                                </IonLabel>
                            </IonItem>
                        ))}
                    </IonList>
                )}

                <FabSpacer />

                <IonFab slot="fixed" vertical="bottom" horizontal="end">
                    <IonFabButton onClick={openCreateModal}>
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>

                {/* Store Name Modal */}
                <IonModal isOpen={isModalOpen} onDidDismiss={closeModal}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>
                                {editingStore ? "Edit Store" : "New Store"}
                            </IonTitle>
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
                                        <IonLabel position="stacked">
                                            Store Name
                                        </IonLabel>
                                        <IonInput
                                            {...field}
                                            placeholder="Enter store name"
                                            autocapitalize="sentences"
                                            onIonInput={(e) =>
                                                field.onChange(e.detail.value)
                                            }
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

                            <IonButton
                                expand="block"
                                type="submit"
                                disabled={
                                    !isValid ||
                                    createStore.isPending ||
                                    updateStore.isPending
                                }
                                style={{ marginTop: "20px" }}
                            >
                                {editingStore ? "Update" : "Create"}
                            </IonButton>
                        </form>
                    </IonContent>
                </IonModal>
            </IonContent>
        </IonPage>
    );
};

export default StoresList;
