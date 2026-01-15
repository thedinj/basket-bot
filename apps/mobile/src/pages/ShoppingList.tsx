import {
    IonAlert,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonItem,
    IonList,
    IonPage,
    IonSkeletonText,
    IonText,
    IonToolbar,
} from "@ionic/react";
import { add, eyeOffOutline, eyeOutline } from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";
import { ANIMATION_EFFECTS } from "../animations/effects";
import { AppHeader } from "../components/layout/AppHeader";
import { PageMenuItemConfig } from "../components/layout/AppHeaderContext";
import { FabSpacer } from "../components/shared/FabSpacer";
import { OverlayAnimation } from "../components/shared/OverlayAnimation";
import { useBulkImportModal } from "../components/shoppinglist/BulkImportModal";
import { CheckedItems } from "../components/shoppinglist/CheckedItems";
import { ItemEditorModal } from "../components/shoppinglist/ItemEditorModal";
import { ShoppingListProvider } from "../components/shoppinglist/ShoppingListProvider";
import { StoreSelector } from "../components/shoppinglist/StoreSelector";
import { UncheckedItems } from "../components/shoppinglist/UncheckedItems";
import { useShoppingListContext } from "../components/shoppinglist/useShoppingListContext";
import { useClearCheckedItems, useShoppingListItems } from "../db/hooks";
import { useOverlayAnimation } from "../hooks/useOverlayAnimation";
import { useShowSnoozedItems } from "../hooks/useShowSnoozedItems";
import { LLMFabButton } from "../llm/shared";

const ShoppingListContent: React.FC = () => {
    const { selectedStoreId, openCreateModal } = useShoppingListContext();

    const { showSnoozed, toggleShowSnoozed } = useShowSnoozedItems();

    const { data: items, isLoading: isLoadingItems } = useShoppingListItems(selectedStoreId || "");

    const clearChecked = useClearCheckedItems();

    // Laser obliteration animation
    const {
        trigger: triggerLaser,
        isActive: isObliterating,
        cssClass,
    } = useOverlayAnimation(ANIMATION_EFFECTS.LASER_OBLITERATION);

    const { openBulkImport, isImporting } = useBulkImportModal(selectedStoreId || "");

    const snoozedItemCount = useMemo(() => {
        if (!items) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return items.filter((item) => {
            if (!item.snoozedUntil) return false;
            const snoozeDate = new Date(item.snoozedUntil);
            return snoozeDate >= today;
        }).length;
    }, [items]);

    const activeItems = useMemo(() => {
        if (showSnoozed) return items;

        return items?.filter((item) => {
            if (!item.snoozedUntil) return true;
            const snoozeDate = new Date(item.snoozedUntil);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return snoozeDate < today;
        });
    }, [items, showSnoozed]);

    const uncheckedItems = activeItems?.filter((item) => !item.isChecked) || [];
    const checkedItems = activeItems?.filter((item) => item.isChecked) || [];

    const [showClearCheckedAlert, setShowClearCheckedAlert] = useState(false);

    // Check if there are any snoozed items
    const handleClearChecked = useCallback(() => {
        setShowClearCheckedAlert(true);
    }, []);

    const confirmClearChecked = useCallback(async () => {
        setShowClearCheckedAlert(false);

        // Trigger laser animation
        await triggerLaser();

        // Wait for animation to complete, then clear items
        setTimeout(() => {
            if (selectedStoreId) {
                clearChecked.mutate({ storeId: selectedStoreId });
            }
        }, ANIMATION_EFFECTS.LASER_OBLITERATION.duration);
    }, [clearChecked, selectedStoreId, triggerLaser]);

    const isLoading = isLoadingItems;

    const menuItems: PageMenuItemConfig[] = [
        {
            id: "toggle-snoozed",
            icon: showSnoozed ? eyeOffOutline : eyeOutline,
            label: (
                <>
                    {showSnoozed ? "Hide Snoozed Items" : "Show Snoozed Items"}{" "}
                    <span style={{ color: "var(--ion-color-medium)" }}>({snoozedItemCount})</span>
                </>
            ),
            onClick: toggleShowSnoozed,
        },
    ];

    return (
        <>
            <AppHeader title="Shopping List" menuItems={menuItems} />
            <IonToolbar>
                <StoreSelector />
            </IonToolbar>
            <IonContent fullscreen>
                {!selectedStoreId && (
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
                )}

                {selectedStoreId && isLoading && (
                    <IonList>
                        {[1, 2, 3].map((i) => (
                            <IonItem key={i}>
                                <IonSkeletonText animated style={{ width: "100%" }} />
                            </IonItem>
                        ))}
                    </IonList>
                )}

                {selectedStoreId && !isLoading && activeItems && activeItems.length === 0 && (
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
                                {snoozedItemCount > 0
                                    ? `(${snoozedItemCount} item${
                                          snoozedItemCount > 1 ? "s" : ""
                                      } snoozed.)`
                                    : ""}
                            </p>
                        </IonText>
                    </div>
                )}

                {selectedStoreId && !isLoading && activeItems && (
                    <>
                        <UncheckedItems items={uncheckedItems} />
                        <CheckedItems
                            items={checkedItems}
                            onClearChecked={handleClearChecked}
                            isClearing={clearChecked.isPending}
                            isFadingOut={isObliterating}
                        />
                    </>
                )}

                {/* Overlay animation */}
                <OverlayAnimation cssClass={cssClass} />

                {selectedStoreId && activeItems && (
                    <>
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
                            <LLMFabButton onClick={openBulkImport} disabled={isImporting} />
                        </IonFab>

                        <ItemEditorModal storeId={selectedStoreId} />
                    </>
                )}
            </IonContent>

            <IonAlert
                isOpen={showClearCheckedAlert}
                onDidDismiss={() => setShowClearCheckedAlert(false)}
                header="Obliterate Checked Items?"
                message={"Clear all checked items? If you're certain you're done with them."}
                buttons={[
                    {
                        text: "Cancel",
                        role: "cancel",
                    },
                    {
                        text: "Obliterate",
                        role: "destructive",
                        handler: confirmClearChecked,
                    },
                ]}
            />
        </>
    );
};

const ShoppingList: React.FC = () => {
    return (
        <IonPage>
            <ShoppingListProvider>
                <ShoppingListContent />
            </ShoppingListProvider>
        </IonPage>
    );
};

export default ShoppingList;
