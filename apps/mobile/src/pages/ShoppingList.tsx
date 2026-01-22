import {
    IonAlert,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonPage,
    IonText,
    IonToolbar,
} from "@ionic/react";
import { add, eyeOffOutline, eyeOutline } from "ionicons/icons";
import { Suspense, useCallback, useMemo, useState } from "react";
import { ANIMATION_EFFECTS } from "../animations/effects";
import { AppHeader } from "../components/layout/AppHeader";
import { PageMenuItemConfig } from "../components/layout/AppHeaderContext";
import LoadingFallback from "../components/LoadingFallback";
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
import { isCurrentlySnoozed } from "../utils/dateUtils";

const ShoppingListWithItems: React.FC<{ storeId: string }> = ({ storeId }) => {
    const { openCreateModal } = useShoppingListContext();
    const { showSnoozed, toggleShowSnoozed } = useShowSnoozedItems();

    // Use Suspense pattern - component suspends until data loads
    const { data: items } = useShoppingListItems(storeId);

    const clearChecked = useClearCheckedItems();

    // Laser obliteration animation
    const {
        trigger: triggerLaser,
        isActive: isObliterating,
        cssClass,
    } = useOverlayAnimation(ANIMATION_EFFECTS.LASER_OBLITERATION);

    const { openBulkImport, isImporting } = useBulkImportModal(storeId);

    const snoozedItemCount = useMemo(() => {
        if (!items) return 0;
        return items.filter((item) => isCurrentlySnoozed(item.snoozedUntil)).length;
    }, [items]);

    const activeItems = useMemo(() => {
        if (showSnoozed) return items;

        return items?.filter((item) => {
            // Show items that are not snoozed or whose snooze has expired
            return !isCurrentlySnoozed(item.snoozedUntil);
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
            clearChecked.mutate({ storeId });
        }, ANIMATION_EFFECTS.LASER_OBLITERATION.duration);
    }, [clearChecked, storeId, triggerLaser]);

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
            <IonContent fullscreen>
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
                                {snoozedItemCount > 0
                                    ? `(${snoozedItemCount} item${
                                          snoozedItemCount > 1 ? "s" : ""
                                      } snoozed.)`
                                    : ""}
                            </p>
                        </IonText>
                    </div>
                )}

                {activeItems.length > 0 && (
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

                <ItemEditorModal storeId={storeId} />
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

const ShoppingListContent: React.FC = () => {
    const { selectedStoreId } = useShoppingListContext();

    if (!selectedStoreId) {
        return (
            <>
                <AppHeader title="Shopping List" menuItems={[]} />
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
