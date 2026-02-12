import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { add, closeOutline, storefrontOutline } from "ionicons/icons";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateStore, useStores } from "../../db/hooks";
import { useAppHeader } from "../layout/useAppHeader";
import StoreManagementModal from "./StoreManagementModal";

const storeFormSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .transform((val) => val.trim()),
});

type StoreFormData = z.infer<typeof storeFormSchema>;

/**
 * Store List Modal - Accessible from AppMenu
 * Shows all stores with options to create new or manage existing
 */
const StoreListModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();
    const { data: stores, isLoading } = useStores();
    const createStore = useCreateStore();
    const isOpen = isModalOpen("stores");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [managingStoreId, setManagingStoreId] = useState<string | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = useForm<StoreFormData>({
        resolver: zodResolver(storeFormSchema),
        mode: "onChange",
    });

    const openCreateModal = useCallback(() => {
        reset({ name: "" });
        setIsCreateModalOpen(true);
    }, [reset]);

    const closeCreateModal = useCallback(() => {
        setIsCreateModalOpen(false);
        reset({ name: "" });
    }, [reset]);

    const onSubmit = useCallback(
        async (data: StoreFormData) => {
            await createStore.mutateAsync(data.name);
            closeCreateModal();
        },
        [createStore, closeCreateModal]
    );

    const handleManageStore = useCallback((storeId: string) => {
        setManagingStoreId(storeId);
    }, []);

    const handleCloseStoreManagement = useCallback(() => {
        setManagingStoreId(null);
    }, []);

    const handleModalDismiss = useCallback(() => {
        closeModal();
    }, [closeModal]);

    const handleCloseButton = useCallback(() => {
        closeModal();
    }, [closeModal]);

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={handleModalDismiss}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Stores</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={handleCloseButton}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    {isLoading ? (
                        <IonList>
                            {[1, 2, 3].map((i) => (
                                <IonItem key={i}>
                                    <IonIcon icon={storefrontOutline} slot="start" />
                                    <IonLabel>
                                        <IonSkeletonText animated style={{ width: "60%" }} />
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
                                    No stores configured. Add one to begin optimizing your shopping.
                                </p>
                            </IonText>
                            <IonButton onClick={openCreateModal} style={{ marginTop: "16px" }}>
                                <IonIcon icon={add} slot="start" />
                                Create Your First Store
                            </IonButton>
                        </div>
                    ) : (
                        <>
                            <IonList>
                                {stores.map((store) => (
                                    <IonItem
                                        key={store.id}
                                        button
                                        detail={false}
                                        onClick={() => {
                                            handleManageStore(store.id);
                                        }}
                                    >
                                        <IonIcon icon={storefrontOutline} slot="start" />
                                        <IonLabel>
                                            <h2>{store.name}</h2>
                                        </IonLabel>
                                    </IonItem>
                                ))}
                            </IonList>
                            <div style={{ padding: "16px" }}>
                                <IonButton expand="block" onClick={openCreateModal}>
                                    <IonIcon icon={add} slot="start" />
                                    Create Store
                                </IonButton>
                            </div>
                        </>
                    )}
                </IonContent>
            </IonModal>

            {/* Create Store Modal */}
            <IonModal isOpen={isCreateModalOpen} onDidDismiss={closeCreateModal}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>New Store</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={closeCreateModal}>
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
                                    <IonLabel position="stacked">Store Name</IonLabel>
                                    <IonInput
                                        {...field}
                                        placeholder="Enter store name"
                                        autocapitalize="sentences"
                                        onIonInput={(e) => field.onChange(e.detail.value)}
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
                            disabled={!isValid || createStore.isPending}
                            style={{ marginTop: "20px" }}
                        >
                            Create
                        </IonButton>
                    </form>
                </IonContent>
            </IonModal>

            {/* Store Management Modal */}
            <StoreManagementModal
                isOpen={managingStoreId !== null}
                onClose={handleCloseStoreManagement}
                storeId={managingStoreId}
            />
        </>
    );
};

export default StoreListModal;
