import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonModal,
    IonReorder,
    IonReorderGroup,
    IonSkeletonText,
    type ItemReorderCustomEvent,
} from "@ionic/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import clsx from "clsx";
import {
    add,
    checkmarkOutline,
    chevronForward,
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
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";
import TabEmptyState from "../shared/TabEmptyState";
import StoreManagementModal from "./StoreManagementModal";
import StoreTemplatePicker from "./StoreTemplatePicker";

import "./StoreSheets.scss";

const STORE_GLYPH_SRC = "/img/Store.svg";

const storeFormSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .transform((val) => val.trim()),
    // Server-defined starting layout. Undefined until the catalog loads (or if it fails),
    // in which case the server creates an empty store.
    templateId: z.string().optional(),
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
        reset({ name: "", templateId: undefined });
        setIsCreateModalOpen(true);
    }, [reset]);

    const closeCreateModal = useCallback(() => {
        setIsCreateModalOpen(false);
        reset({ name: "", templateId: undefined });
    }, [reset]);

    const onSubmit = useCallback(
        async (data: StoreFormData) => {
            await createStore.mutateAsync({ name: data.name, templateId: data.templateId });
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

    const hasStores = !isLoading && !!stores?.length;

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={handleModalDismiss}>
                <ModalHeader
                    title="Stores"
                    onClose={handleCloseButton}
                    start={
                        stores &&
                        stores.length > 1 && (
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
                        )
                    }
                />
                <IonContent>
                    {isLoading ? (
                        <IonList className="store-list" aria-hidden="true">
                            {[1, 2, 3].map((i) => (
                                <IonItem key={i} className="store-row" lines="inset">
                                    <IonIcon src={STORE_GLYPH_SRC} slot="start" />
                                    <IonSkeletonText animated className="store-list__skeleton" />
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
                                <p className="store-reorder-hint">
                                    <IonIcon icon={reorderThreeOutline} aria-hidden="true" />
                                    <span>Drag the handles to set your tab order</span>
                                </p>
                            )}
                            <IonList className="store-list">
                                <IonReorderGroup
                                    disabled={!reorderMode}
                                    onIonItemReorder={handleReorder}
                                >
                                    {sortedStores.map((store) => (
                                        <IonItem
                                            key={store.id}
                                            className={clsx(
                                                "store-row",
                                                store.isHidden && "store-row--hidden"
                                            )}
                                            lines="inset"
                                            button={!reorderMode}
                                            detail={false}
                                            onClick={
                                                reorderMode
                                                    ? undefined
                                                    : () => handleManageStore(store.id)
                                            }
                                        >
                                            <IonIcon
                                                src={STORE_GLYPH_SRC}
                                                slot="start"
                                                aria-hidden="true"
                                            />
                                            <span className="store-row__name">{store.name}</span>
                                            {store.isHidden && (
                                                <span className="info-pill store-row__pill">
                                                    <IonIcon
                                                        icon={eyeOffOutline}
                                                        aria-hidden="true"
                                                    />
                                                    Hidden
                                                </span>
                                            )}
                                            {reorderMode ? (
                                                <IonReorder slot="end" />
                                            ) : (
                                                <IonIcon
                                                    icon={chevronForward}
                                                    slot="end"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </IonItem>
                                    ))}
                                </IonReorderGroup>
                            </IonList>
                        </>
                    )}
                </IonContent>
                {hasStores && !reorderMode && (
                    <EditorFooter>
                        <IonButton
                            className="editor-form__submit"
                            expand="block"
                            onClick={openCreateModal}
                        >
                            <IonIcon icon={add} slot="start" />
                            Create Store
                        </IonButton>
                    </EditorFooter>
                )}
            </IonModal>

            {/* Create Store Modal */}
            <IonModal isOpen={isCreateModalOpen} onDidDismiss={closeCreateModal}>
                <ModalHeader title="New Store" onClose={closeCreateModal} />
                <IonContent className="ion-padding">
                    <form className="editor-form" onSubmit={handleSubmit(onSubmit)}>
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <FormField label="Name" error={errors.name?.message}>
                                    <div className="form-control">
                                        <IonInput
                                            aria-label="Store name"
                                            value={field.value}
                                            placeholder="Enter store name"
                                            autocapitalize="sentences"
                                            onIonInput={(e) => field.onChange(e.detail.value)}
                                            onIonBlur={field.onBlur}
                                        />
                                    </div>
                                </FormField>
                            )}
                        />

                        <Controller
                            name="templateId"
                            control={control}
                            render={({ field }) => (
                                <StoreTemplatePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </form>
                </IonContent>
                <EditorFooter>
                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        onClick={handleSubmit(onSubmit)}
                        disabled={!isValid || createStore.isPending}
                    >
                        Create
                    </IonButton>
                </EditorFooter>
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
