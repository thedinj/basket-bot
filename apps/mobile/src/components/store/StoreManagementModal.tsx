import { toSingleEmojiOrNull } from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonModal,
    IonSkeletonText,
    IonTitle,
    IonToggle,
    IonToolbar,
    useIonAlert,
} from "@ionic/react";
import {
    chevronForward,
    copyOutline,
    createOutline,
    eyeOffOutline,
    eyeOutline,
    gridOutline,
    homeOutline,
    listOutline,
} from "ionicons/icons";
import React, { ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
    useBulkApplyAislesAndSections,
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
    storeScanResultSchema,
    type ExistingAisle,
    type ExistingSection,
    type StoreScanResult,
} from "../../llm/features/storeScan";
import {
    generateStoreScanPrompt,
    type ExistingStoreLayout,
} from "../../llm/features/storeScanPrompt";
import { useLLMModal } from "../../llm/shared";
import { LLM_ICON_SRC } from "../../llm/shared/constants";
import { AislePlate } from "../shared/AislePlate";
import { DestructiveAction } from "../shared/DestructiveAction";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { aislePlate } from "../shared/grouping.utils";
import { ModalHeader } from "../shared/ModalHeader";
import { useShield } from "../shield/useShield";
import AislesSectionsManagementModal from "./AislesSectionsManagementModal";
import StoreHouseholdSharingModal from "./StoreHouseholdSharingModal";
import StoreItemsManagementModal from "./StoreItemsManagementModal";

import "./StoreSheets.scss";

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

// Interaction state for the store scan LLM modal
interface StoreScanState {
    mode: "append" | "replace";
    uncheckedAisles: Set<number>;
    uncheckedSections: Set<string>; // composite key "aisleIdx:sectionIdx"
}

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

interface StoreScanOutputListProps {
    result: StoreScanResult;
    state: StoreScanState;
    setState: React.Dispatch<React.SetStateAction<StoreScanState>>;
}

const StoreScanOutputList: React.FC<StoreScanOutputListProps> = ({ result, state, setState }) => {
    const toggleAisle = (aisleIdx: number, checked: boolean): void => {
        setState((prev) => {
            const nextUncheckedAisles = new Set(prev.uncheckedAisles);
            const nextUncheckedSections = new Set(prev.uncheckedSections);
            if (!checked) {
                nextUncheckedAisles.add(aisleIdx);
                result.aisles[aisleIdx].sections.forEach((_, sectionIdx) => {
                    nextUncheckedSections.add(`${aisleIdx}:${sectionIdx}`);
                });
            } else {
                nextUncheckedAisles.delete(aisleIdx);
                result.aisles[aisleIdx].sections.forEach((_, sectionIdx) => {
                    nextUncheckedSections.delete(`${aisleIdx}:${sectionIdx}`);
                });
            }
            return {
                ...prev,
                uncheckedAisles: nextUncheckedAisles,
                uncheckedSections: nextUncheckedSections,
            };
        });
    };

    const toggleSection = (aisleIdx: number, sectionIdx: number, checked: boolean): void => {
        setState((prev) => {
            const nextUncheckedSections = new Set(prev.uncheckedSections);
            const key = `${aisleIdx}:${sectionIdx}`;
            if (!checked) {
                nextUncheckedSections.add(key);
            } else {
                nextUncheckedSections.delete(key);
            }
            return { ...prev, uncheckedSections: nextUncheckedSections };
        });
    };

    return (
        <div className="store-scan">
            <FormField
                label="Existing layout"
                hint={
                    state.mode === "replace"
                        ? "The current aisles and sections are deleted first."
                        : "Found aisles and sections are added to the current ones."
                }
            >
                <div className="form-control">
                    <IonToggle
                        labelPlacement="start"
                        justify="space-between"
                        checked={state.mode === "replace"}
                        onIonChange={(e) =>
                            setState((prev) => ({
                                ...prev,
                                mode: e.detail.checked ? "replace" : "append",
                            }))
                        }
                    >
                        Replace existing aisles & sections
                    </IonToggle>
                </div>
            </FormField>

            <section>
                <h2 className="ruled-label">
                    Aisles <span className="ruled-label__count">{result.aisles.length}</span>
                </h2>
                <ul className="store-scan__aisles">
                    {result.aisles.map((aisle, aisleIdx) => {
                        const aisleChecked = !state.uncheckedAisles.has(aisleIdx);
                        // The plate the shopping list will draw for this aisle once it's saved
                        // (the same emoji validation the save applies).
                        const plate = aislePlate({
                            aisleId: aisleIdx,
                            aisleName: aisle.name,
                            aisleEmoji: toSingleEmojiOrNull(aisle.emoji),
                        });
                        return (
                            <li key={aisleIdx} className="store-scan__aisle">
                                <IonCheckbox
                                    className="store-scan__check"
                                    labelPlacement="end"
                                    justify="start"
                                    checked={aisleChecked}
                                    aria-label={aisle.name}
                                    onIonChange={(e) => toggleAisle(aisleIdx, e.detail.checked)}
                                >
                                    <span className="store-scan__aisle-label">
                                        <AislePlate badge={plate.badge} kind={plate.badgeKind} />
                                        {plate.label && (
                                            <span className="store-scan__aisle-name">
                                                {plate.label}
                                            </span>
                                        )}
                                    </span>
                                </IonCheckbox>
                                {aisle.sections.length > 0 && (
                                    <ul className="store-scan__sections">
                                        {aisle.sections.map((section, sectionIdx) => {
                                            const sectionKey = `${aisleIdx}:${sectionIdx}`;
                                            return (
                                                <li key={sectionKey}>
                                                    <IonCheckbox
                                                        className="store-scan__check store-scan__check--section"
                                                        labelPlacement="end"
                                                        justify="start"
                                                        checked={
                                                            !state.uncheckedSections.has(sectionKey)
                                                        }
                                                        disabled={!aisleChecked}
                                                        onIonChange={(e) =>
                                                            toggleSection(
                                                                aisleIdx,
                                                                sectionIdx,
                                                                e.detail.checked
                                                            )
                                                        }
                                                    >
                                                        <span className="store-scan__section-name">
                                                            {section}
                                                        </span>
                                                    </IonCheckbox>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
};

type HubRowProps = {
    icon: ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
};

/** One action in the store hub: glyph on the gutter, title and a line of explanation. */
const HubRow: React.FC<HubRowProps> = ({ icon, title, description, onClick, disabled }) => (
    <button
        type="button"
        className="row-button store-hub-row"
        onClick={onClick}
        disabled={disabled}
    >
        {icon}
        <span className="store-hub-row__text">
            <span className="store-hub-row__title">{title}</span>
            <span className="store-hub-row__desc">{description}</span>
        </span>
        <IonIcon className="store-hub-row__chevron" icon={chevronForward} aria-hidden="true" />
    </button>
);

const hubIcon = (icon: string) => (
    <IonIcon className="store-hub-row__icon" icon={icon} aria-hidden="true" />
);

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
    const { applyAislesAndSections } = useBulkApplyAislesAndSections();
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

        openModal<StoreScanResult, StoreScanState>({
            title: "Scan Store Directory",
            prompt: generateStoreScanPrompt(existingLayout),
            userInstructions:
                "Take a photo of the store directory showing aisle numbers and their sections/categories.",
            tier: "vision",
            schema: storeScanResultSchema,
            buttonText: "Scan Aisles & Sections",
            shieldMessage: "Scanning store directory...",
            initialState: (): StoreScanState => ({
                mode: "append",
                uncheckedAisles: new Set(),
                uncheckedSections: new Set(),
            }),
            renderOutput: (
                response: { data: StoreScanResult },
                state: StoreScanState,
                setState: React.Dispatch<React.SetStateAction<StoreScanState>>
            ) => <StoreScanOutputList result={response.data} state={state} setState={setState} />,
            onAccept: (response: { data: StoreScanResult }, state: StoreScanState) => {
                const filteredResult: StoreScanResult = {
                    aisles: response.data.aisles
                        .map((aisle, aisleIdx) => ({ aisle, aisleIdx }))
                        .filter(({ aisleIdx }) => !state.uncheckedAisles.has(aisleIdx))
                        .map(({ aisle, aisleIdx }) => ({
                            name: aisle.name,
                            emoji: aisle.emoji,
                            sections: aisle.sections.filter(
                                (_, sectionIdx) =>
                                    !state.uncheckedSections.has(`${aisleIdx}:${sectionIdx}`)
                            ),
                        })),
                };
                const transformed = transformStoreScanResult(
                    filteredResult,
                    existingAislesForMatching,
                    existingSectionsForMatching
                );
                // Don't await - let shield take over for background work
                applyAislesAndSections({
                    storeId: storeId!,
                    aisles: transformed.aisles,
                    sections: transformed.sections,
                    mode: state.mode,
                });
            },
        });
    }, [storeId, database, openModal, applyAislesAndSections]);

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
            <ModalHeader title={store.name} onClose={handleClose} />
            <IonContent className="store-hub">
                <section className="store-hub__group">
                    <h2 className="ruled-label store-hub__label">Layout</h2>
                    <div className="store-hub__rows">
                        <HubRow
                            icon={hubIcon(gridOutline)}
                            title="Edit Aisles/Sections"
                            description="Organize store layout"
                            onClick={handleOpenAislesModal}
                        />
                        <HubRow
                            icon={hubIcon(listOutline)}
                            title="Edit Store Items"
                            description="Manage products and their locations"
                            onClick={handleOpenItemsModal}
                        />
                        <HubRow
                            icon={
                                <IonIcon
                                    className="store-hub-row__icon store-hub-row__icon--llm"
                                    src={LLM_ICON_SRC}
                                    aria-hidden="true"
                                />
                            }
                            title="Auto-Scan Aisles/Sections"
                            description="Import from store directory photo"
                            onClick={handleAutoScan}
                        />
                    </div>
                </section>

                <section className="store-hub__group">
                    <h2 className="ruled-label store-hub__label">Access</h2>
                    <div className="store-hub__rows">
                        <HubRow
                            icon={hubIcon(homeOutline)}
                            title="Share with Household"
                            description="Everyone in your household, or only you."
                            onClick={handleOpenHouseholdSharingModal}
                        />
                        {/* On means shown: the label names what the switch turns on, and
                            the line under it reports the current state. */}
                        <IonToggle
                            className="store-hub-row"
                            labelPlacement="start"
                            justify="space-between"
                            checked={!store.isHidden}
                            onIonChange={(e) => handleToggleVisibility(!e.detail.checked)}
                            disabled={updateStoreVisibility.isPending}
                        >
                            <span className="store-hub-row__label">
                                {hubIcon(store.isHidden ? eyeOffOutline : eyeOutline)}
                                <span className="store-hub-row__text">
                                    <span className="store-hub-row__title">
                                        Show in store lists
                                    </span>
                                    <span className="store-hub-row__desc">
                                        {store.isHidden
                                            ? "Hidden. Left out of store dropdowns."
                                            : "Listed in store dropdowns."}
                                    </span>
                                </span>
                            </span>
                        </IonToggle>
                    </div>
                </section>

                <section className="store-hub__group">
                    <h2 className="ruled-label store-hub__label">Store</h2>
                    <div className="store-hub__rows">
                        <HubRow
                            icon={hubIcon(createOutline)}
                            title="Rename Store"
                            description="Change the name on its tab"
                            onClick={openRenameModal}
                        />
                        <HubRow
                            icon={hubIcon(copyOutline)}
                            title="Duplicate Store"
                            description="Copy layout and optionally items"
                            onClick={openDuplicateModal}
                        />
                    </div>
                </section>

                <div className="store-hub__danger">
                    <DestructiveAction onClick={handleDeleteStore} busy={deleteStore.isPending}>
                        Delete store
                    </DestructiveAction>
                </div>

                {/* Rename Store Modal */}
                <IonModal isOpen={isRenameModalOpen} onDidDismiss={closeRenameModal}>
                    <ModalHeader title="Rename Store" onClose={closeRenameModal} />
                    <IonContent className="ion-padding">
                        <form className="editor-form" onSubmit={handleSubmit(onSubmitRename)}>
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
                                                onIonInput={(e) => field.onChange(e.detail.value)}
                                                autocapitalize="sentences"
                                            />
                                        </div>
                                    </FormField>
                                )}
                            />
                        </form>
                    </IonContent>
                    <EditorFooter>
                        <IonButton
                            className="editor-form__submit"
                            expand="block"
                            onClick={handleSubmit(onSubmitRename)}
                            disabled={!isValid || updateStore.isPending}
                        >
                            Update
                        </IonButton>
                    </EditorFooter>
                </IonModal>

                {/* Duplicate Store Modal */}
                <IonModal isOpen={isDuplicateModalOpen} onDidDismiss={closeDuplicateModal}>
                    <ModalHeader title="Duplicate Store" onClose={closeDuplicateModal} />
                    <IonContent className="ion-padding">
                        <form
                            className="editor-form"
                            onSubmit={handleDuplicateSubmit(onSubmitDuplicate)}
                        >
                            <Controller
                                name="name"
                                control={duplicateControl}
                                render={({ field }) => (
                                    <FormField
                                        label="New store name"
                                        error={duplicateErrors.name?.message}
                                    >
                                        <div className="form-control">
                                            <IonInput
                                                aria-label="New store name"
                                                value={field.value}
                                                placeholder="Enter store name"
                                                onIonInput={(e) => field.onChange(e.detail.value)}
                                                autocapitalize="sentences"
                                            />
                                        </div>
                                    </FormField>
                                )}
                            />

                            <Controller
                                name="includeItems"
                                control={duplicateControl}
                                render={({ field }) => (
                                    <FormField
                                        label="Store items"
                                        hint="Copies the product catalog with aisle/section locations. Shopping list items are never copied."
                                    >
                                        <div className="form-control">
                                            <IonToggle
                                                labelPlacement="start"
                                                justify="space-between"
                                                checked={field.value}
                                                onIonChange={(e) =>
                                                    field.onChange(e.detail.checked)
                                                }
                                            >
                                                Copy store items
                                            </IonToggle>
                                        </div>
                                    </FormField>
                                )}
                            />
                        </form>
                    </IonContent>
                    <EditorFooter>
                        <IonButton
                            className="editor-form__submit"
                            expand="block"
                            onClick={handleDuplicateSubmit(onSubmitDuplicate)}
                            disabled={!isDuplicateValid || duplicateStore.isPending}
                        >
                            Duplicate
                        </IonButton>
                    </EditorFooter>
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
        <IonContent className="store-hub">
            <section className="store-hub__group" aria-hidden="true">
                <div className="store-hub__rows">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="store-hub-row">
                            {hubIcon(listOutline)}
                            <span className="store-hub-row__text">
                                <IonSkeletonText animated className="store-hub__skeleton" />
                                <IonSkeletonText animated className="store-hub__skeleton" />
                            </span>
                        </div>
                    ))}
                </div>
            </section>
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
