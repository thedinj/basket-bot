import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonButtons,
    IonCheckbox,
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
    IonToggle,
    IonToolbar,
    useIonAlert,
} from "@ionic/react";
import {
    closeOutline,
    copy,
    create,
    eyeOffOutline,
    eyeOutline,
    gridOutline,
    homeOutline,
    listOutline,
    trash,
} from "ionicons/icons";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
    useBulkReplaceAislesAndSections,
    useDatabase,
    useDeleteStore,
    useDuplicateStore,
    useStoreSuspense,
    useUpdateStore,
    useUpdateStoreVisibility,
} from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import {
    transformStoreScanResult,
    validateStoreScanResult,
    type ExistingAisle,
    type ExistingSection,
    type StoreScanResult,
} from "../../llm/features/storeScan";
import {
    generateStoreScanPrompt,
    type ExistingStoreLayout,
} from "../../llm/features/storeScanPrompt";
import { LLMItem, useLLMModal } from "../../llm/shared";
import { useShield } from "../shield/useShield";
import AislesSectionsManagementModal from "./AislesSectionsManagementModal";
import StoreHouseholdSharingModal from "./StoreHouseholdSharingModal";
import StoreItemsManagementModal from "./StoreItemsManagementModal";

// Zod schemas
const storeFormSchema = z.object({
    name: z.string().min(1, "Store name is required"),
});
type StoreFormData = z.infer<typeof storeFormSchema>;

const duplicateStoreFormSchema = z.object({
    name: z.string().min(1, "Store name is required"),
    includeItems: z.boolean(),
});
type DuplicateStoreFormData = z.infer<typeof duplicateStoreFormSchema>;

// LLM store scan types imported from llm/features/storeScan

interface StoreManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string | null;
}

interface StoreManagementModalContentProps {
    storeId: string;
    onClose: () => void;
}

const StoreManagementModalContent: React.FC<StoreManagementModalContentProps> = ({
    storeId,
    onClose,
}) => {
    const [presentAlert] = useIonAlert();
    const { data: store } = useStoreSuspense(storeId);
    const database = useDatabase();
    const updateStore = useUpdateStore();
    const deleteStore = useDeleteStore();
    const duplicateStore = useDuplicateStore();
    const updateStoreVisibility = useUpdateStoreVisibility();
    const { replaceAislesAndSections } = useBulkReplaceAislesAndSections();
    const { openModal } = useLLMModal();
    const { raiseShield, lowerShield } = useShield();
    const { showError, showSuccess } = useToast();

    // Rename modal state
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const openRenameModal = useCallback(() => setIsRenameModalOpen(true), []);
    const closeRenameModal = useCallback(() => setIsRenameModalOpen(false), []);

    // Duplicate modal state
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const openDuplicateModal = useCallback(() => setIsDuplicateModalOpen(true), []);
    const closeDuplicateModal = useCallback(() => setIsDuplicateModalOpen(false), []);

    // Household sharing modal state
    const [isHouseholdSharingModalOpen, setIsHouseholdSharingModalOpen] = useState(false);
    const handleOpenHouseholdSharingModal = useCallback(
        () => setIsHouseholdSharingModalOpen(true),
        []
    );
    const handleCloseHouseholdSharingModal = useCallback(
        () => setIsHouseholdSharingModalOpen(false),
        []
    );

    // Nested modal state
    const [isAislesModalOpen, setIsAislesModalOpen] = useState(false);
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);

    const handleOpenAislesModal = useCallback(() => setIsAislesModalOpen(true), []);
    const handleOpenItemsModal = useCallback(() => setIsItemsModalOpen(true), []);
    const handleCloseAislesModal = useCallback(() => setIsAislesModalOpen(false), []);
    const handleCloseItemsModal = useCallback(() => setIsItemsModalOpen(false), []);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    // Rename form
    const {
        control,
        handleSubmit,
        reset: resetForm,
        formState: { errors, isValid },
    } = useForm<StoreFormData>({
        resolver: zodResolver(storeFormSchema),
        mode: "onChange",
        defaultValues: useMemo(
            () => ({
                name: store?.name || "",
            }),
            [store?.name]
        ),
    });

    // Duplicate form
    const {
        control: duplicateControl,
        handleSubmit: handleDuplicateSubmit,
        formState: { errors: duplicateErrors, isValid: isDuplicateValid },
    } = useForm<DuplicateStoreFormData>({
        resolver: zodResolver(duplicateStoreFormSchema),
        mode: "onChange",
        defaultValues: {
            name: store ? `${store.name} (Copy)` : "",
            includeItems: false,
        },
    });

    // Update form when store changes
    useEffect(() => {
        if (store) {
            resetForm({ name: store.name });
        }
    }, [resetForm, store]);

    // Reset nested modal states when storeId changes
    // Only reset if storeId is actually changing to prevent unnecessary renders
    useEffect(() => {
        if (storeId) {
            setIsRenameModalOpen(false);
            setIsDuplicateModalOpen(false);
            setIsHouseholdSharingModalOpen(false);
            setIsAislesModalOpen(false);
            setIsItemsModalOpen(false);
        }
    }, [storeId]);

    // Rename handler
    const onSubmitRename = useCallback(
        async (data: StoreFormData) => {
            try {
                await updateStore.mutateAsync({
                    id: storeId!,
                    name: data.name,
                });
                showSuccess("Store renamed successfully");
                closeRenameModal();
            } catch (_error) {
                showError("Failed to rename store");
            }
        },
        [closeRenameModal, showError, showSuccess, storeId, updateStore]
    );

    // Duplicate handler
    const onSubmitDuplicate = useCallback(
        async (data: DuplicateStoreFormData) => {
            const shieldId = "duplicate-store";
            try {
                raiseShield(shieldId, "Duplicating store...");
                await duplicateStore.mutateAsync({
                    sourceStoreId: storeId!,
                    newStoreName: data.name,
                    includeItems: data.includeItems,
                });
                showSuccess("Store duplicated successfully");
                closeDuplicateModal();
                // Close parent modal and show success
                handleClose();
            } catch (_error) {
                showError("Failed to duplicate store");
            } finally {
                lowerShield(shieldId);
            }
        },
        [
            closeDuplicateModal,
            duplicateStore,
            lowerShield,
            handleClose,
            raiseShield,
            showError,
            showSuccess,
            storeId,
        ]
    );

    // Delete handler
    const handleDeleteStore = useCallback(async () => {
        if (!store) return;

        await presentAlert({
            header: "Delete Store",
            message: `Are you sure you want to delete "${store.name}"? This will also delete all aisles, sections, and items for this store. Shopping list items will remain but lose their location data.`,
            buttons: [
                { text: "Cancel", role: "cancel" },
                {
                    text: "Delete",
                    role: "destructive",
                    handler: () => {
                        // CRITICAL: Do NOT use history here in an alert handler.
                        // Ionic router is unreliable inside alert handlers within tab layouts.
                        // Instead, close the modal first and let the parent handle navigation.
                        deleteStore
                            .mutateAsync(storeId!)
                            .then(() => {
                                showSuccess("Store deleted successfully");
                                handleClose(); // Close the modal
                            })
                            .catch(() => {
                                showError("Failed to delete store");
                            });
                    },
                },
            ],
        });
    }, [deleteStore, handleClose, presentAlert, showError, showSuccess, store, storeId]);

    // Visibility toggle handler
    const handleToggleVisibility = useCallback(
        async (isHidden: boolean) => {
            try {
                await updateStoreVisibility.mutateAsync({
                    storeId: storeId!,
                    isHidden,
                });
            } catch (_error) {
                // Error handling is done by the hook
            }
        },
        [storeId, updateStoreVisibility]
    );

    // LLM auto-scan handler
    const handleAutoScan = useCallback(async () => {
        // Fetch existing aisles and sections for ID preservation
        const existingAisles = await database.getAislesByStore(storeId!);
        const existingSections = await database.getSectionsByStore(storeId!);

        // Prepare data for prompt (group sections by aisle)
        const existingLayout: ExistingStoreLayout[] = existingAisles.map((aisle) => ({
            name: aisle.name,
            sections: existingSections
                .filter((section) => section.aisleId === aisle.id)
                .map((section) => section.name),
        }));

        // Prepare data for transformer (keep IDs for matching)
        const existingAislesForMatching: ExistingAisle[] = existingAisles.map((a) => ({
            id: a.id,
            name: a.name,
        }));
        const existingSectionsForMatching: ExistingSection[] = existingSections.map((s) => ({
            id: s.id,
            name: s.name,
        }));

        openModal<StoreScanResult>({
            title: "Scan Store Directory",
            prompt: generateStoreScanPrompt(existingLayout),
            userInstructions:
                "Take a photo of the store directory showing aisle numbers and their sections/categories.",
            model: "gpt-5.2",
            buttonText: "Scan Aisles & Sections",
            shieldMessage: "Scanning store directory...",
            validateResponse: (response: { data: unknown }) => {
                if (!validateStoreScanResult(response.data)) {
                    throw new Error(
                        "Invalid scan result format. Could not parse aisles and sections."
                    );
                }
                return true;
            },
            renderOutput: (response: { data: StoreScanResult }) => {
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
                            {result.aisles.map(
                                (aisle: { name: string; sections: string[] }, idx: number) => (
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
                                )
                            )}
                        </IonList>
                    </div>
                );
            },
            onAccept: (response: { data: StoreScanResult }) => {
                const transformed = transformStoreScanResult(
                    response.data,
                    existingAislesForMatching,
                    existingSectionsForMatching
                );
                // Don't await - let shield take over for background work
                replaceAislesAndSections({
                    storeId: storeId!,
                    aisles: transformed.aisles,
                    sections: transformed.sections,
                });
            },
        });
    }, [storeId, database, openModal, replaceAislesAndSections]);

    // Don't render if no storeId provided
    if (!storeId) {
        return null;
    }

    // Handle deleted/non-existent store
    if (!store) {
        showError("Store not found or no longer available.");
        handleClose();
        return null;
    }

    return (
        <>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{store.name}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleDeleteStore} disabled={deleteStore.isPending}>
                            <IonIcon slot="icon-only" icon={trash} />
                        </IonButton>
                        <IonButton onClick={openRenameModal}>
                            <IonIcon slot="icon-only" icon={create} />
                        </IonButton>
                        <IonButton onClick={handleClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonList>
                    <LLMItem button detail={true} onClick={handleAutoScan} requireApiKey={false}>
                        <IonLabel>
                            <h2>Auto-Scan Aisles/Sections</h2>
                            <p>Import from store directory photo</p>
                        </IonLabel>
                    </LLMItem>

                    <IonItem button detail={true} onClick={handleOpenHouseholdSharingModal}>
                        <IonIcon icon={homeOutline} slot="start" />
                        <IonLabel>
                            <h2>Share with Household</h2>
                            <p>
                                Determine if this store is available to everyone in your household
                                or only you.
                            </p>
                        </IonLabel>
                    </IonItem>

                    <IonItem>
                        <IonIcon icon={store.isHidden ? eyeOffOutline : eyeOutline} slot="start" />
                        <IonLabel>
                            <h2>Hidden from Store Lists</h2>
                            <p>Hides this store from dropdowns.</p>
                        </IonLabel>
                        <IonToggle
                            slot="end"
                            checked={store.isHidden}
                            onIonChange={(e) => handleToggleVisibility(e.detail.checked)}
                            disabled={updateStoreVisibility.isPending}
                        />
                    </IonItem>

                    <IonItem button detail={true} onClick={openDuplicateModal}>
                        <IonIcon icon={copy} slot="start" />
                        <IonLabel>
                            <h2>Duplicate Store</h2>
                            <p>Copy layout and optionally items</p>
                        </IonLabel>
                    </IonItem>
                    <IonItem button detail={true} onClick={handleOpenAislesModal}>
                        <IonIcon icon={gridOutline} slot="start" />
                        <IonLabel>
                            <h2>Edit Aisles/Sections</h2>
                            <p>Organize store layout</p>
                        </IonLabel>
                    </IonItem>
                    <IonItem button detail={true} onClick={handleOpenItemsModal}>
                        <IonIcon icon={listOutline} slot="start" />
                        <IonLabel>
                            <h2>Edit Store Items</h2>
                            <p>Manage products and their locations</p>
                        </IonLabel>
                    </IonItem>
                </IonList>

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

                {/* Duplicate Store Modal */}
                <IonModal isOpen={isDuplicateModalOpen} onDidDismiss={closeDuplicateModal}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Duplicate Store</IonTitle>
                            <IonButtons slot="end">
                                <IonButton onClick={closeDuplicateModal}>
                                    <IonIcon icon={closeOutline} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent className="ion-padding">
                        <form onSubmit={handleDuplicateSubmit(onSubmitDuplicate)}>
                            <Controller
                                name="name"
                                control={duplicateControl}
                                render={({ field }) => (
                                    <IonItem>
                                        <IonLabel position="stacked">New Store Name</IonLabel>
                                        <IonInput
                                            value={field.value}
                                            placeholder="Enter store name"
                                            onIonInput={(e) => field.onChange(e.detail.value)}
                                            autocapitalize="sentences"
                                        />
                                    </IonItem>
                                )}
                            />
                            {duplicateErrors.name && (
                                <IonText color="danger">
                                    <p
                                        style={{
                                            fontSize: "12px",
                                            marginLeft: "16px",
                                        }}
                                    >
                                        {duplicateErrors.name.message}
                                    </p>
                                </IonText>
                            )}

                            <Controller
                                name="includeItems"
                                control={duplicateControl}
                                render={({ field }) => (
                                    <IonItem style={{ marginTop: "16px" }}>
                                        <IonCheckbox
                                            checked={field.value}
                                            onIonChange={(e) => field.onChange(e.detail.checked)}
                                        >
                                            Include store items
                                        </IonCheckbox>
                                    </IonItem>
                                )}
                            />
                            <IonText color="medium">
                                <p
                                    style={{
                                        fontSize: "12px",
                                        marginLeft: "16px",
                                        marginTop: "8px",
                                    }}
                                >
                                    Copies the product catalog with aisle/section locations.
                                    Shopping list items are never copied.
                                </p>
                            </IonText>

                            <IonButton
                                expand="block"
                                type="submit"
                                disabled={!isDuplicateValid || duplicateStore.isPending}
                                style={{ marginTop: "20px" }}
                            >
                                Duplicate
                            </IonButton>
                        </form>
                    </IonContent>
                </IonModal>

                {/* Household Sharing Modal */}
                <StoreHouseholdSharingModal
                    store={store || null}
                    isOpen={isHouseholdSharingModalOpen}
                    onClose={handleCloseHouseholdSharingModal}
                />
            </IonContent>

            {/* Nested Modals */}
            <AislesSectionsManagementModal
                isOpen={isAislesModalOpen}
                onClose={handleCloseAislesModal}
                storeId={storeId}
            />
            <StoreItemsManagementModal
                isOpen={isItemsModalOpen}
                onClose={handleCloseItemsModal}
                storeId={storeId}
            />
        </>
    );
};

const LoadingFallback: React.FC = () => (
    <>
        <IonHeader>
            <IonToolbar>
                <IonTitle>
                    <IonSkeletonText animated style={{ width: "120px" }} />
                </IonTitle>
            </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
            <IonList>
                {[1, 2, 3, 4].map((i) => (
                    <IonItem key={i}>
                        <IonIcon icon={listOutline} slot="start" />
                        <IonLabel>
                            <IonSkeletonText animated style={{ width: "60%" }} />
                            <IonSkeletonText animated style={{ width: "80%" }} />
                        </IonLabel>
                    </IonItem>
                ))}
            </IonList>
        </IonContent>
    </>
);

const StoreManagementModal: React.FC<StoreManagementModalProps> = ({
    isOpen,
    onClose,
    storeId,
}) => {
    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            {storeId && (
                <Suspense fallback={<LoadingFallback />}>
                    <StoreManagementModalContent storeId={storeId} onClose={onClose} />
                </Suspense>
            )}
        </IonModal>
    );
};

export default StoreManagementModal;
