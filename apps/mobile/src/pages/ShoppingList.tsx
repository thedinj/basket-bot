import StoreItemsManagementModal from "@/components/store/StoreItemsManagementModal";
import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import {
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonPage,
    IonText,
    useIonAlert,
} from "@ionic/react";
import { add, helpCircle, helpCircleOutline, listOutline } from "ionicons/icons";
import pluralize from "pluralize";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ShoppingListSkeleton from "../components/shoppinglist/ShoppingListSkeleton";
import { StoreSelector } from "../components/shoppinglist/StoreSelector";
import { UncheckedItems } from "../components/shoppinglist/UncheckedItems";
import { useShoppingListContext } from "../components/shoppinglist/useShoppingListContext";
import { useClearCheckedItems, useShoppingListItems, useStores } from "../db/hooks";
import { queryKeys } from "../db/queryKeys";
import RefreshConfig from "../hooks/refresh/RefreshConfig";
import { useMidnightUpdate } from "../hooks/useMidnightUpdate";
import { useOverlayAnimation } from "../hooks/useOverlayAnimation";
import { useShowSnoozedItems } from "../hooks/useShowSnoozedItems";
import { useShowUnsureItems } from "../hooks/useShowUnsureItems";
import { LLMFabButton } from "../llm/shared";
import { isCurrentlySnoozed } from "../utils/dateUtils";

import "./ShoppingList.scss";

// The keep-awake header button hasn't proven useful in practice; disabled rather than
// removed so the underlying feature (useKeepAwake, GlobalActions support) stays intact.
const KEEP_AWAKE_BUTTON_ENABLED = false;

const SHOW_UNSURE_ONLY_FILTER: boolean = false;

interface ShoppingListHeaderExtrasProps {
    storeId: string;
    showSnoozed: boolean;
    toggleShowSnoozed: () => void;
    showUnsureOnly: boolean;
    toggleShowUnsureOnly: () => void;
    onProgressChange: (progress: number | null) => void;
}

/**
 * The header pieces that need item data (trip progress, the snoozed-items toggle). Rendered
 * inside its own Suspense boundary with a `null` fallback so the rest of AppHeader (title,
 * StoreSelector, the always-available quick-add button) never has to wait on it — this is
 * exactly what let the header disappear entirely behind the list skeleton before.
 */
const ShoppingListHeaderExtras: React.FC<ShoppingListHeaderExtrasProps> = ({
    storeId,
    showSnoozed,
    toggleShowSnoozed,
    showUnsureOnly,
    toggleShowUnsureOnly,
    onProgressChange,
}) => {
    const { data: items } = useShoppingListItems(storeId);

    const hasItemsWithSnoozeUntil = useMemo(
        () => items.some((item) => item.snoozedUntil !== null),
        [items]
    );
    const currentDate = useMidnightUpdate(hasItemsWithSnoozeUntil);

    const currentlySnoozedItemCount = useMemo(() => {
        return items.filter((item) => isCurrentlySnoozed(item.snoozedUntil)).length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, currentDate]);

    const activeItems = useMemo(() => {
        if (showSnoozed) return items;
        return items.filter((item) => !isCurrentlySnoozed(item.snoozedUntil));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, showSnoozed, currentDate]);

    const uncheckedItems = useMemo(
        () => activeItems.filter((item) => !item.isChecked),
        [activeItems]
    );
    const checkedItems = activeItems.filter((item) => item.isChecked);
    const unsureCount = useMemo(
        () => uncheckedItems.filter((item) => item.isUnsure).length,
        [uncheckedItems]
    );
    const tripProgress = activeItems.length > 0 ? checkedItems.length / activeItems.length : null;

    useEffect(() => {
        onProgressChange(tripProgress);
    }, [tripProgress, onProgressChange]);

    const actions = useMemo<GlobalActionConfig[]>(() => {
        const result: GlobalActionConfig[] = [];

        // Snoozed items toggle (conditional)
        if (currentlySnoozedItemCount > 0) {
            result.push({
                id: "toggle-snoozed",
                customIconSrc: "/img/ZzzIcon.svg",
                title: `${showSnoozed ? "Hide" : "Show"} snoozed items (${currentlySnoozedItemCount})`,
                ariaLabel: `${showSnoozed ? "Hide" : "Show"} snoozed items`,
                onClick: toggleShowSnoozed,
                color: showSnoozed ? "primary" : undefined,
                messageGenerator: () => ({
                    message: showSnoozed ? "Hiding snoozed items." : "Showing snoozed items.",
                    type: "info" as const,
                }),
            });
        }

        // Unsure items filter toggle — stays visible while the filter is active even if
        // this store currently has no unsure items (e.g. after switching stores), so the
        // user can always turn it back off; otherwise only shown when there's something to filter
        if (SHOW_UNSURE_ONLY_FILTER && (unsureCount > 0 || showUnsureOnly)) {
            const countSuffix = unsureCount > 0 ? ` (${unsureCount})` : "";
            result.push({
                id: "toggle-unsure-filter",
                icon: showUnsureOnly ? helpCircle : helpCircleOutline,
                title: `${showUnsureOnly ? "Show all items" : "Show only unsure items"}${countSuffix}`,
                ariaLabel: `${showUnsureOnly ? "Show all items" : "Show only unsure items"}`,
                onClick: toggleShowUnsureOnly,
                color: showUnsureOnly ? "warning" : undefined,
                className: showUnsureOnly ? "unsure-filter-btn--active" : undefined,
                messageGenerator: () => ({
                    message: showUnsureOnly ? "Showing all items." : "Showing only unsure items.",
                    type: "info" as const,
                }),
            });
        }

        return result;
    }, [
        currentlySnoozedItemCount,
        showSnoozed,
        toggleShowSnoozed,
        unsureCount,
        showUnsureOnly,
        toggleShowUnsureOnly,
    ]);

    return <GlobalActions actions={actions} />;
};

interface ShoppingListBodyProps {
    storeId: string;
    showSnoozed: boolean;
    showUnsureOnly: boolean;
}

const ShoppingListBody: React.FC<ShoppingListBodyProps> = ({
    storeId,
    showSnoozed,
    showUnsureOnly,
}) => {
    const { openCreateModal } = useShoppingListContext();
    const { data: items } = useShoppingListItems(storeId);
    const clearChecked = useClearCheckedItems();
    const [presentAlert] = useIonAlert();
    const [wasJustCleared, setWasJustCleared] = useState(false);

    // Laser obliteration animation
    const {
        trigger: triggerLaser,
        isActive: isObliterating,
        cssClass,
    } = useOverlayAnimation(ANIMATION_EFFECTS.LASER_OBLITERATION);

    const { openBulkImport } = useBulkImportModal(storeId);

    // Check if there are any snoozed items (enable midnight updates only if needed)
    const hasItemsWithSnoozeUntil = useMemo(
        () => items.some((item) => item.snoozedUntil !== null),
        [items]
    );
    const currentDate = useMidnightUpdate(hasItemsWithSnoozeUntil);

    const currentlySnoozedItemCount = useMemo(() => {
        return items.filter((item) => isCurrentlySnoozed(item.snoozedUntil)).length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, currentDate]);

    const activeItems = useMemo(() => {
        if (showSnoozed) return items;
        return items.filter((item) => !isCurrentlySnoozed(item.snoozedUntil));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, showSnoozed, currentDate]);

    const [hasTriggeredClear, setHasTriggeredClear] = useState(false);
    const obliterationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // The component now stays mounted across store switches (see ShoppingListContent), so
    // any transient per-store UI state — and a still-pending obliteration timeout captured
    // for the previous store — must be reset explicitly rather than relying on a remount.
    useEffect(() => {
        setHasTriggeredClear(false);
        setWasJustCleared(false);
        if (obliterationTimeoutRef.current) {
            clearTimeout(obliterationTimeoutRef.current);
            obliterationTimeoutRef.current = null;
        }
    }, [storeId]);

    const uncheckedItems = useMemo(
        () => activeItems.filter((item) => !item.isChecked),
        [activeItems]
    );
    const checkedItems = activeItems.filter((item) => item.isChecked);

    const displayedUncheckedItems = showUnsureOnly
        ? uncheckedItems.filter((item) => item.isUnsure)
        : uncheckedItems;

    // Reset clear flag when checked items are actually gone
    if (hasTriggeredClear && checkedItems.length === 0) {
        setHasTriggeredClear(false);
    }

    const confirmClearChecked = useCallback(async () => {
        // Trigger laser animation
        await triggerLaser();

        // Clear items when forward beam finishes (~1s), independent of full animation duration
        obliterationTimeoutRef.current = setTimeout(() => {
            setHasTriggeredClear(true);
            setWasJustCleared(true);
            clearChecked.mutate({ storeId });
            obliterationTimeoutRef.current = null;
        }, 1000);
    }, [clearChecked, storeId, triggerLaser]);

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

    return (
        <IonContent fullscreen className="shopping-list-content">
            <PullToRefresh />
            {activeItems.length === 0 && (
                <div className="shopping-list-empty-state">
                    <IonText color="medium">
                        <p>
                            {wasJustCleared ? (
                                "Acquisition complete. No remaining targets detected."
                            ) : (
                                <>
                                    Your list is empty. Tap + to add items, if your memory
                                    permits.
                                    <br />
                                    <br />
                                    {currentlySnoozedItemCount > 0
                                        ? `(${currentlySnoozedItemCount} ${pluralize("item", currentlySnoozedItemCount)} snoozed.)`
                                        : ""}
                                </>
                            )}
                        </p>
                    </IonText>
                </div>
            )}

            {activeItems.length > 0 && (
                <>
                    {showUnsureOnly && (
                        <div className="unsure-filter-banner">Showing unsure items only</div>
                    )}
                    {showUnsureOnly && displayedUncheckedItems.length === 0 ? (
                        <div className="shopping-list-empty-state">
                            <IonText color="medium">
                                <p>No unsure items left to reconcile.</p>
                            </IonText>
                        </div>
                    ) : (
                        <UncheckedItems items={displayedUncheckedItems} />
                    )}
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
            <IonFab vertical="bottom" horizontal="end" slot="fixed" className="bulk-import-fab">
                <LLMFabButton onClick={openBulkImport} />
            </IonFab>

            <ItemEditorModal storeId={storeId} />
        </IonContent>
    );
};

interface ShoppingListShellProps {
    storeId: string;
}

/**
 * Header/toolbar/FAB shell for a selected store — never itself suspends, so it (and the
 * store selector) stay visible while ShoppingListBody's own Suspense boundary shows the list
 * skeleton for a not-yet-loaded store.
 */
const ShoppingListShell: React.FC<ShoppingListShellProps> = ({ storeId }) => {
    const { data: stores } = useStores();
    const multipleStores = stores && stores.length > 1;
    const { showSnoozed, toggleShowSnoozed } = useShowSnoozedItems();
    const { showUnsureOnly, toggleShowUnsureOnly } = useShowUnsureItems();
    const [isStoreItemsModalOpen, setIsStoreItemsModalOpen] = useState(false);
    const [tripProgress, setTripProgress] = useState<number | null>(null);

    // Avoid briefly showing the previous store's progress bar under the new store's header.
    useEffect(() => {
        setTripProgress(null);
        setIsStoreItemsModalOpen(false);
    }, [storeId]);

    const staticActions = useMemo<GlobalActionConfig[]>(
        () => [
            {
                id: "quick-add-store-items",
                icon: listOutline,
                title: "Quick add store items",
                ariaLabel: "Open store items quick-add modal",
                onClick: () => setIsStoreItemsModalOpen(true),
            },
        ],
        []
    );

    return (
        <RefreshConfig queryKeys={[queryKeys.shoppingListItems.byStore(storeId)]}>
            <AppHeader
                title="Shopping List"
                subToolbar={multipleStores ? <StoreSelector /> : undefined}
                progress={tripProgress}
            >
                <GlobalActions showKeepAwake={KEEP_AWAKE_BUTTON_ENABLED} actions={staticActions} />
                <Suspense fallback={null}>
                    <ShoppingListHeaderExtras
                        storeId={storeId}
                        showSnoozed={showSnoozed}
                        toggleShowSnoozed={toggleShowSnoozed}
                        showUnsureOnly={showUnsureOnly}
                        toggleShowUnsureOnly={toggleShowUnsureOnly}
                        onProgressChange={setTripProgress}
                    />
                </Suspense>
            </AppHeader>

            <Suspense fallback={<ShoppingListSkeleton />}>
                {/* Keyed by storeId: a clean remount per store guarantees this can never render
                    one store's cached data under a different store's id — cheap and instant
                    for a store already visited this session (its query is already cached), and
                    only shows the skeleton fallback for a genuinely never-loaded store. */}
                <ShoppingListBody
                    key={storeId}
                    storeId={storeId}
                    showSnoozed={showSnoozed}
                    showUnsureOnly={showUnsureOnly}
                />
            </Suspense>

            {/* Favorites Quick Add Modal */}
            <StoreItemsManagementModal
                isOpen={isStoreItemsModalOpen}
                onClose={() => setIsStoreItemsModalOpen(false)}
                storeId={storeId}
            />
        </RefreshConfig>
    );
};

const ShoppingListContent: React.FC = () => {
    const { selectedStoreId } = useShoppingListContext();
    const { data: stores } = useStores();
    const multipleStores = stores && stores.length > 1;

    if (!selectedStoreId) {
        return (
            <>
                <AppHeader
                    title="Shopping List"
                    subToolbar={multipleStores ? <StoreSelector /> : undefined}
                />
                <IonContent fullscreen>
                    <div className="shopping-list-empty-state">
                        <IonText color="medium">
                            <p>Select a store, human. I cannot assist without data.</p>
                        </IonText>
                    </div>
                </IonContent>
            </>
        );
    }

    // Stays mounted across store switches (rather than remounting via a key) so the header/
    // toolbar/FAB don't blank out; ShoppingListShell/ShoppingListBody reset their own
    // per-store transient state (see their storeId effects) instead of relying on a fresh
    // mount to do it.
    return <ShoppingListShell storeId={selectedStoreId} />;
};

const ShoppingList: React.FC = () => {
    useRenderStormDetector("ShoppingList");

    return (
        <IonPage>
            <Suspense fallback={<LoadingFallback />}>
                <ShoppingListProvider>
                    <Suspense fallback={<LoadingFallback />}>
                        <ShoppingListContent />
                    </Suspense>
                </ShoppingListProvider>
            </Suspense>
        </IonPage>
    );
};

export default ShoppingList;
