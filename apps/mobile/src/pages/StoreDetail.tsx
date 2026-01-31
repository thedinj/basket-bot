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
    IonPage,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
    useIonAlert,
} from "@ionic/react";
import {
    closeOutline,
    create,
    gridOutline,
    listOutline,
    peopleOutline,
    trash,
} from "ionicons/icons";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useHistory, useParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/layout/AppHeader";
import { StoreCollaboratorsModal } from "../components/store/StoreCollaboratorsModal";
import {
    useBulkReplaceAislesAndSections,
    useDeleteStore,
    useStore,
    useStoreCollaborators,
    useUpdateStore,
} from "../db/hooks";
import {
    transformStoreScanResult,
    validateStoreScanResult,
    type StoreScanResult,
} from "../llm/features/storeScan";
import { STORE_SCAN_PROMPT } from "../llm/features/storeScanPrompt";
import { LLMItem, useLLMModal } from "../llm/shared";

const storeFormSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .transform((val) => val.trim()),
});

type StoreFormData = z.infer<typeof storeFormSchema>;

const StoreDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const { user } = useAuth();
    const { data: store, isLoading } = useStore(id);
    const { data: collaborators } = useStoreCollaborators(id);
    const updateStore = useUpdateStore();
    const deleteStore = useDeleteStore();
    const { replaceAislesAndSections } = useBulkReplaceAislesAndSections();
    const { openModal } = useLLMModal();
    const [presentAlert] = useIonAlert();
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);

    // Determine current user's role
    const currentUserRole = collaborators?.find((c) => c.userId === user?.id)?.role;

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isValid },
    } = useForm<StoreFormData>({
        resolver: zodResolver(storeFormSchema),
        mode: "onChange",
    });

    const openRenameModal = useCallback(() => {
        if (store) {
            reset({ name: store.name });
            setIsRenameModalOpen(true);
        }
    }, [reset, store]);

    const closeRenameModal = useCallback(() => {
        setIsRenameModalOpen(false);
        reset({ name: "" });
    }, [reset]);

    const onSubmitRename = useCallback(
        async (data: StoreFormData) => {
            await updateStore.mutateAsync({ id, name: data.name });
            closeRenameModal();
        },
        [closeRenameModal, id, updateStore]
    );

    const handleDeleteStore = useCallback(() => {
        presentAlert({
            header: "Delete Store",
            message: `Are you sure you want to delete "${store?.name}"? This will also delete all aisles, sections, and items for this store.`,
            buttons: [
                {
                    text: "Cancel",
                    role: "cancel",
                },
                {
                    text: "Delete",
                    role: "destructive",
                    handler: async () => {
                        try {
                            await deleteStore.mutateAsync(id);
                            // CRITICAL: Use React Router's history.replace() instead of useIonRouter().push()
                            // Ionic's router navigation does NOT work reliably when called from IonAlert's
                            // onDidDismiss callback or button handlers within a tabs layout context.
                            // The navigation would update the URL but fail to unmount/remount the page component,
                            // leaving the user stuck viewing the deleted store's page with an updated URL.
                            // React Router's history.replace() bypasses Ionic's animation/transition system
                            // and directly manipulates the browser history, which properly triggers the
                            // route change and component unmount. This is the recommended pattern for
                            // navigation after destructive operations initiated from alerts/modals.
                            history.replace("/stores");
                        } catch (_error: unknown) {
                            // Error is already handled by the mutation hook (toast shown)
                        }
                    },
                },
            ],
        });
    }, [deleteStore, history, id, presentAlert, store?.name]);

    const handleAutoScan = useCallback(() => {
        openModal<StoreScanResult>({
            title: "Scan Store Directory",
            prompt: STORE_SCAN_PROMPT,
            userInstructions:
                "Take a photo of the store directory showing aisle numbers and their sections/categories.",
            model: "gpt-5.2",
            buttonText: "Scan Aisles & Sections",
            shieldMessage: "Scanning store directory...",
            validateResponse: (response) => {
                if (!validateStoreScanResult(response.data)) {
                    throw new Error(
                        "Invalid scan result format. Could not parse aisles and sections."
                    );
                }
                return true;
            },
            renderOutput: (response) => {
                const result = response.data;
                return (
                    <div>
                        <IonText color="medium">
                            <p>
                                Found {result.aisles.length} aisle
                                {result.aisles.length !== 1 ? "s" : ""}
                            </p>
                        </IonText>
                        <IonList>
                            {result.aisles.map((aisle, idx) => (
                                <div key={idx}>
                                    <IonItem lines="none">
                                        <IonLabel>
                                            <h3>
                                                <strong>{aisle.name}</strong>
                                            </h3>
                                        </IonLabel>
                                    </IonItem>
                                    {aisle.sections.length > 0 && (
                                        <IonItem>
                                            <IonLabel
                                                className="ion-text-wrap"
                                                style={{ paddingLeft: "16px" }}
                                            >
                                                <p>{aisle.sections.join(", ")}</p>
                                            </IonLabel>
                                        </IonItem>
                                    )}
                                </div>
                            ))}
                        </IonList>
                    </div>
                );
            },
            onAccept: (response) => {
                const transformed = transformStoreScanResult(response.data);
                // Don't await - let shield take over for background work
                replaceAislesAndSections({
                    storeId: id,
                    aisles: transformed.aisles,
                    sections: transformed.sections,
                });
            },
        });
    }, [id, openModal, replaceAislesAndSections]);

    return (
        <IonPage>
            <AppHeader
                title={
                    isLoading ? (
                        <IonSkeletonText animated style={{ width: "120px" }} />
                    ) : (
                        store?.name || "Store"
                    )
                }
                showBackButton
                backButtonHref="/stores"
            >
                <IonButtons slot="end">
                    <IonButton onClick={openRenameModal} disabled={isLoading}>
                        <IonIcon slot="icon-only" icon={create} />
                    </IonButton>
                </IonButtons>
            </AppHeader>
            <IonContent fullscreen>
                <IonList>
                    <LLMItem button detail={true} onClick={handleAutoScan} requireApiKey={false}>
                        <IonLabel>
                            <h2>Auto-Scan Aisles/Sections</h2>
                            <p>Import from store directory photo</p>
                        </IonLabel>
                    </LLMItem>
                    <IonItem button detail={true} onClick={() => setShowCollaboratorsModal(true)}>
                        <IonIcon icon={peopleOutline} slot="start" />
                        <IonLabel>
                            <h2>Share Store</h2>
                            <p>Manage collaborators and invitations</p>
                        </IonLabel>
                    </IonItem>
                    <IonItem
                        button
                        detail={true}
                        routerLink={`/stores/${encodeURIComponent(id)}/aisles`}
                    >
                        <IonIcon icon={gridOutline} slot="start" />
                        <IonLabel>
                            <h2>Edit Aisles/Sections</h2>
                            <p>Organize store layout</p>
                        </IonLabel>
                    </IonItem>
                    <IonItem
                        button
                        detail={true}
                        routerLink={`/stores/${encodeURIComponent(id)}/items`}
                    >
                        <IonIcon icon={listOutline} slot="start" />
                        <IonLabel>
                            <h2>Edit Store Items</h2>
                            <p>Manage products and their locations</p>
                        </IonLabel>
                    </IonItem>
                </IonList>

                <div className="ion-padding">
                    <IonButton
                        expand="block"
                        color="danger"
                        fill="outline"
                        onClick={handleDeleteStore}
                        disabled={isLoading || deleteStore.isPending}
                    >
                        <IonIcon slot="start" icon={trash} />
                        Delete Store
                    </IonButton>
                </div>

                {/* Rename Store Modal */}
                <IonModal isOpen={isRenameModalOpen} onDidDismiss={closeRenameModal}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Rename Store</IonTitle>
                            <IonButtons slot="end">
                                <IonButton onClick={closeRenameModal}>
                                    <IonIcon icon={closeOutline} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        <form onSubmit={handleSubmit(onSubmitRename)}>
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <IonItem>
                                        <IonLabel position="stacked">Store Name</IonLabel>
                                        <IonInput
                                            value={field.value}
                                            placeholder="Enter store name"
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

                            <IonButton
                                expand="block"
                                type="submit"
                                disabled={!isValid || updateStore.isPending}
                                style={{ marginTop: "20px" }}
                            >
                                Update
                            </IonButton>
                        </form>
                    </IonContent>
                </IonModal>

                {/* Store Collaborators Modal */}
                {currentUserRole && (
                    <StoreCollaboratorsModal
                        isOpen={showCollaboratorsModal}
                        onDismiss={() => setShowCollaboratorsModal(false)}
                        storeId={id}
                        userRole={currentUserRole}
                    />
                )}
            </IonContent>
        </IonPage>
    );
};

export default StoreDetail;
