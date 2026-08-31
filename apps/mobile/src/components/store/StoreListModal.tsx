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
    IonReorder,
    IonReorderGroup,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
    type ItemReorderCustomEvent,
} from "@ionic/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
    add,
    checkmarkOutline,
    closeOutline,
    eyeOffOutline,
    reorderThreeOutline,
    storefrontOutline,
    swapVerticalOutline,
} from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateStore, useReorderStores, useStores } from "../../db/hooks";
import { sortStoresByPreference } from "../../utils/storeSort";
import { useAppHeader } from "../layout/useAppHeader";
import TabEmptyState from "../shared/TabEmptyState";
import StoreManagementModal from "./StoreManagementModal";

import "./StoreListModal.scss";

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
    const reorderStores = useReorderStores();
    const isOpen = isModalOpen("stores");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [managingStoreId, setManagingStoreId] = useState<string | null>(null);
    const [reorderMode, setReorderMode] = useState(false);

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
        setReorderMode(false);
        closeModal();
    }, [closeModal]);

    const handleCloseButton = useCallback(() => {
        setReorderMode(false);
        closeModal();
    }, [closeModal]);

    // Sort stores by the user's custom order (unordered stores fall back to alphabetical).
    // This mirrors the shopping-list tab bar so dragging here is WYSIWYG.
    const sortedStores = useMemo(() => sortStoresByPreference(stores ?? []), [stores]);

    const handleReorder = useCallback(
        (event: ItemReorderCustomEvent) => {
            const items = [...sortedStores];
            const [moved] = items.splice(event.detail.from, 1);
            items.splice(event.detail.to, 0, moved);
            // Let Ionic settle the DOM move; the refetched order will confirm it.
            event.detail.complete();
            // A light tap confirms the drop landed — same feedback as checking off an item.
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
            // Persist a dense position for every store so ordering stays stable.
            reorderStores.mutate(
                items.map((store, index) => ({ storeId: store.id, sortOrder: index }))
            );
        },
        [sortedStores, reorderStores]
    );

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={handleModalDismiss}>
                <IonHeader>
                    <IonToolbar>
                        {stores && stores.length > 1 && (
                            <IonButtons slot="start">
                                <IonButton
                                    onClick={() => setReorderMode((prev) => !prev)}
                                    color={reorderMode ? "primary" : undefined}
                                    aria-label={reorderMode ? "Done reordering" : "Reorder stores"}
                                    aria-pressed={reorderMode}
                                >
                                    <IonIcon
                                        slot="icon-only"
                                        icon={reorderMode ? checkmarkOutline : swapVerticalOutline}
                                    />
                                </IonButton>
                            </IonButtons>
                        )}
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
                                    <IonIcon src={"/img/Store.svg"} slot="start" />
                                    <IonLabel>
                                        <IonSkeletonText animated style={{ width: "60%" }} />
                                    </IonLabel>
                                </IonItem>
                            ))}
                        </IonList>
                    ) : !stores?.length ? (
                        <TabEmptyState
                            variant="full"
                            icon={storefrontOutline}
                            title="No stores configured"
                            body="Add one to begin optimizing your shopping."
                            action={
                                <IonButton onClick={openCreateModal}>
                                    <IonIcon icon={add} slot="start" />
                                    Create Your First Store
                                </IonButton>
                            }
                        />
                    ) : (
                        <>
                            {reorderMode && (
                                <div className="store-reorder-hint">
                                    <IonIcon icon={reorderThreeOutline} aria-hidden="true" />
                                    <span>Drag the handles to set your tab order</span>
                                </div>
                            )}
                            <IonList>
                                <IonReorderGroup
                                    disabled={!reorderMode}
                                    onIonItemReorder={handleReorder}
                                >
                                    {sortedStores.map((store) => (
                                        <IonItem
                                            key={store.id}
                                            button={!reorderMode}
                                            detail={false}
                                            onClick={
                                                reorderMode
                                                    ? undefined
                                                    : () => handleManageStore(store.id)
                                            }
                                        >
                                            <IonIcon src="/img/Store.svg" slot="start" />
                                            <IonLabel
                                                style={{
                                                    opacity: store.isHidden ? 0.5 : 1,
                                                }}
                                            >
                                                <h2>
                                                    {store.name}
                                                    {store.isHidden && (
                                                        <IonIcon
                                                            icon={eyeOffOutline}
                                                            style={{
                                                                fontSize: "16px",
                                                                marginLeft: "8px",
                                                                verticalAlign: "middle",
                                                            }}
                                                        />
                                                    )}
                                                </h2>
                                            </IonLabel>
                                            {reorderMode && <IonReorder slot="end" />}
                                        </IonItem>
                                    ))}
                                </IonReorderGroup>
                            </IonList>
                            {!reorderMode && (
                                <div style={{ padding: "16px" }}>
                                    <IonButton expand="block" onClick={openCreateModal}>
                                        <IonIcon icon={add} slot="start" />
                                        Create Store
                                    </IonButton>
                                </div>
                            )}
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
