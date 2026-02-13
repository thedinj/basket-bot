import StoreItemsManagementModal from "@/components/store/StoreItemsManagementModal";
import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import {
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonPage,
    IonText,
    IonToolbar,
    useIonAlert,
} from "@ionic/react";
import { add, listOutline } from "ionicons/icons";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ANIMATION_EFFECTS } from "../animations/effects";
import { AppHeader } from "../components/layout/AppHeader";
import { GlobalActionConfig } from "../components/layout/AppHeaderContext";
import { GlobalActions } from "../components/layout/GlobalActions";
import LoadingFallback from "../components/LoadingFallback";
import { FabSpacer } from "../components/shared/FabSpacer";
import { OverlayAnimation } from "../components/shared/OverlayAnimation";
import PullToRefresh from "../components/shared/PullToRefresh";
import { useBulkImportModal } from "../components/shoppinglist/BulkImportModal";
import { CheckedItems } from "../components/shoppinglist/CheckedItems";
import { ItemEditorModal } from "../components/shoppinglist/ItemEditorModal";
import { ShoppingListProvider } from "../components/shoppinglist/ShoppingListProvider";
import { StoreSelector } from "../components/shoppinglist/StoreSelector";
import { UncheckedItems } from "../components/shoppinglist/UncheckedItems";
import { useShoppingListContext } from "../components/shoppinglist/useShoppingListContext";
import { useClearCheckedItems, useShoppingListItems } from "../db/hooks";
import RefreshConfig from "../hooks/refresh/RefreshConfig";
import { useMidnightUpdate } from "../hooks/useMidnightUpdate";
import { useOverlayAnimation } from "../hooks/useOverlayAnimation";
import { useShowSnoozedItems } from "../hooks/useShowSnoozedItems";
import { LLMFabButton } from "../llm/shared";
import { isCurrentlySnoozed } from "../utils/dateUtils";

const ShoppingListWithItems: React.FC<{ storeId: string }> = ({ storeId }) => {
    const { openCreateModal } = useShoppingListContext();
    const { showSnoozed, toggleShowSnoozed } = useShowSnoozedItems();
    const { data: items } = useShoppingListItems(storeId);
    const clearChecked = useClearCheckedItems();
    const [presentAlert] = useIonAlert();
    const [isStoreItemsModalOpen, setIsStoreItemsModalOpen] = useState(false);

    // Laser obliteration animation
    const {
        trigger: triggerLaser,
        isActive: isObliterating,
        cssClass,
    } = useOverlayAnimation(ANIMATION_EFFECTS.LASER_OBLITERATION);

    const { openBulkImport } = useBulkImportModal(storeId);

    // Check if there are any snoozed items (enable midnight updates only if needed)
    const hasItemsWithSnoozeUntil = useMemo(
        () => items?.some((item) => item.snoozedUntil !== null) ?? false,
        [items]
    );
    const currentDate = useMidnightUpdate(hasItemsWithSnoozeUntil);

    const currentlySnoozedItemCount = useMemo(() => {
        if (!items) return 0;
        return items.filter((item) => isCurrentlySnoozed(item.snoozedUntil)).length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, currentDate]);

    const activeItems = useMemo(() => {
        if (showSnoozed) return items;

        return items?.filter((item) => {
            // Show items that are not snoozed or whose snooze has expired
            return !isCurrentlySnoozed(item.snoozedUntil);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, showSnoozed, currentDate]);

    const [hasTriggeredClear, setHasTriggeredClear] = useState(false);

    const uncheckedItems = activeItems?.filter((item) => !item.isChecked) || [];
    const checkedItems = activeItems?.filter((item) => item.isChecked) || [];

    // Reset clear flag when checked items are actually gone
    if (hasTriggeredClear && checkedItems.length === 0) {
        setHasTriggeredClear(false);
    }

    const confirmClearChecked = useCallback(async () => {
        // Trigger laser animation
        await triggerLaser();

        // Wait for animation to complete, then clear items
        setTimeout(() => {
            setHasTriggeredClear(true);
            clearChecked.mutate({ storeId });
        }, ANIMATION_EFFECTS.LASER_OBLITERATION.duration);
    }, [clearChecked, storeId, triggerLaser, setHasTriggeredClear]);

    // Check if there are any snoozed items
    const handleClearChecked = useCallback(() => {
        presentAlert({
            header: "Obliterate Checked Items?",
            message: "Clear all checked items? If you're certain you're done with them.",
            buttons: [
                {
                    text: "Cancel",
                    role: "cancel",
                },
                {
                    text: "Obliterate",
                    role: "destructive",
                    handler: confirmClearChecked,
                },
            ],
        });
    }, [presentAlert, confirmClearChecked]);

    const customActions = useMemo<GlobalActionConfig[]>(() => {
        const actions: GlobalActionConfig[] = [];

        // Snoozed items toggle (conditional)
        if (currentlySnoozedItemCount > 0) {
            actions.push({
                id: "toggle-snoozed",
                customIconSrc: "/img/ZzzIcon.svg",
                title: `${showSnoozed ? "Hide" : "Show"} snoozed items (${currentlySnoozedItemCount})`,
                ariaLabel: `${showSnoozed ? "Hide" : "Show"} snoozed items`,
                onClick: toggleShowSnoozed,
                color: showSnoozed ? "primary" : undefined,
                messageGenerator: () => {
                    return {
                        message: showSnoozed ? "Hiding snoozed items." : "Showing snoozed items.",
                        type: "info" as const,
                    };
                },
            });
        }

        // Store Items quick-add
        actions.push({
            id: "quick-add-store-items",
            icon: listOutline,
            title: "Quick add store items",
            ariaLabel: "Open store items quick-add modal",
            onClick: () => setIsStoreItemsModalOpen(true),
        });

        return actions;
    }, [currentlySnoozedItemCount, showSnoozed, toggleShowSnoozed]);

    return (
        <RefreshConfig queryKeys={[["shopping-list-items", storeId]]}>
            <AppHeader title="Shopping List">
                <GlobalActions showKeepAwake actions={customActions} />
            </AppHeader>
            <IonContent fullscreen>
                <PullToRefresh />
                {activeItems.length === 0 && (
                    <div
                        style={{
                            textAlign: "center",
                            marginTop: "40px",
                            padding: "20px",
                        }}
                    >
                        <IonText color="medium">
                            <p>
                                Your list is empty. Tap + to add items, if your memory permits.
                                <br />
                                <br />
                                {currentlySnoozedItemCount > 0
                                    ? `(${currentlySnoozedItemCount} item${
                                          currentlySnoozedItemCount > 1 ? "s" : ""
                                      } snoozed.)`
                                    : ""}
                            </p>
                        </IonText>
                    </div>
                )}

                {activeItems.length > 0 && (
                    <>
                        <UncheckedItems items={uncheckedItems} />
                        {!hasTriggeredClear && (
                            <CheckedItems
                                items={checkedItems}
                                onClearChecked={handleClearChecked}
                                isClearing={clearChecked.isPending}
                                isFadingOut={isObliterating}
                            />
                        )}
                    </>
                )}

                {/* Overlay animation */}
                <OverlayAnimation cssClass={cssClass} />

                <FabSpacer />

                {/* Add Item FAB */}
                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton color="primary" onClick={openCreateModal}>
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>

                {/* Bulk Import FAB */}
                <IonFab
                    vertical="bottom"
                    horizontal="end"
                    slot="fixed"
                    style={{ marginRight: "70px" }}
                >
                    <LLMFabButton onClick={openBulkImport} />
                </IonFab>

                <ItemEditorModal storeId={storeId} />

                {/* Favorites Quick Add Modal */}
                <StoreItemsManagementModal
                    isOpen={isStoreItemsModalOpen}
                    onClose={() => setIsStoreItemsModalOpen(false)}
                    storeId={storeId}
                />
            </IonContent>
        </RefreshConfig>
    );
};

const ShoppingListContent: React.FC = () => {
    const { selectedStoreId } = useShoppingListContext();

    if (!selectedStoreId) {
        return (
            <>
                <AppHeader title="Shopping List" />
                <IonToolbar>
                    <StoreSelector />
                </IonToolbar>
                <IonContent fullscreen>
                    <div
                        style={{
                            textAlign: "center",
                            marginTop: "40px",
                            padding: "20px",
                        }}
                    >
                        <IonText color="medium">
                            <p>Select a store, human. I cannot assist without data.</p>
                        </IonText>
                    </div>
                </IonContent>
            </>
        );
    }

    return (
        <>
            <IonToolbar>
                <StoreSelector />
            </IonToolbar>
            <ShoppingListWithItems storeId={selectedStoreId} />
        </>
    );
};

const ShoppingList: React.FC = () => {
    useRenderStormDetector("ShoppingList");

    return (
        <IonPage>
            <Suspense fallback={<LoadingFallback />}>
                <ShoppingListProvider>
                    <ShoppingListContent />
                </ShoppingListProvider>
            </Suspense>
        </IonPage>
    );
};

export default ShoppingList;
