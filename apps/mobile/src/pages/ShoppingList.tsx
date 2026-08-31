import StoreItemsManagementModal from "@/components/store/StoreItemsManagementModal";
import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import { IonContent, IonFab, IonFabButton, IonIcon, IonPage, useIonAlert } from "@ionic/react";
import {
    add,
    checkmarkDoneOutline,
    helpCircle,
    helpCircleOutline,
    listOutline,
    storefrontOutline,
} from "ionicons/icons";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANIMATION_EFFECTS } from "../animations/effects";
import { AppHeader } from "../components/layout/AppHeader";
import { GlobalActionConfig } from "../components/layout/AppHeaderContext";
import { GlobalActions } from "../components/layout/GlobalActions";
import LoadingFallback from "../components/LoadingFallback";
import { FabSpacer } from "../components/shared/FabSpacer";
import { OverlayAnimation } from "../components/shared/OverlayAnimation";
import PullToRefresh from "../components/shared/PullToRefresh";
import TabEmptyState from "../components/shared/TabEmptyState";
import { useBulkImportModal } from "../components/shoppinglist/BulkImportModal";
import { CheckedItems } from "../components/shoppinglist/CheckedItems";
import { ItemEditorModal } from "../components/shoppinglist/ItemEditorModal";
import { ShoppingListProvider } from "../components/shoppinglist/ShoppingListProvider";
import ShoppingListSkeleton from "../components/shoppinglist/ShoppingListSkeleton";
import { StoreSelector } from "../components/shoppinglist/StoreSelector";
import { UncheckedItems } from "../components/shoppinglist/UncheckedItems";
import { useShoppingListContext } from "../components/shoppinglist/useShoppingListContext";
import {
    useClearCheckedItems,
    useShoppingListItems,
    useShoppingListItemsIfLoaded,
    useStores,
} from "../db/hooks";
import { queryKeys } from "../db/queryKeys";
import RefreshConfig from "../hooks/refresh/RefreshConfig";
import { useOverlayAnimation } from "../hooks/useOverlayAnimation";
import { useShowSnoozedItems } from "../hooks/useShowSnoozedItems";
import { useShowUnsureItems } from "../hooks/useShowUnsureItems";
import { useSnoozePartition } from "../hooks/useSnoozePartition";
import { LLMFabButton } from "../llm/shared";
import { computeTripProgress, isPendingUnsure } from "../utils/shoppingListDerivations";

import "./ShoppingList.scss";

// The keep-awake header button hasn't proven useful in practice; disabled rather than
// removed so the underlying feature (useKeepAwake, GlobalActions support) stays intact.
const KEEP_AWAKE_BUTTON_ENABLED = false;

const SHOW_UNSURE_ONLY_FILTER: boolean = false;

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

    const { activeItems } = useSnoozePartition(items, showSnoozed);

    const [hasTriggeredClear, setHasTriggeredClear] = useState(false);
    const obliterationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // This component is keyed by storeId (see ShoppingListShell), so a store switch remounts it
    // and resets the clear/obliteration state for free — no explicit per-storeId reset needed.
    // What a remount does *not* do is cancel the outgoing instance's pending obliteration, whose
    // callback still holds the old storeId and would clear that store's checked items ~1s later.
    useEffect(() => {
        return () => {
            if (obliterationTimeoutRef.current) {
                clearTimeout(obliterationTimeoutRef.current);
                obliterationTimeoutRef.current = null;
            }
        };
    }, []);

    const uncheckedItems = useMemo(
        () => activeItems.filter((item) => !item.isChecked),
        [activeItems]
    );
    const checkedItems = activeItems.filter((item) => item.isChecked);

    const displayedUncheckedItems = showUnsureOnly
        ? uncheckedItems.filter(isPendingUnsure)
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
            {activeItems.length === 0 &&
                (wasJustCleared ? (
                    <TabEmptyState
                        icon={checkmarkDoneOutline}
                        title="Acquisition complete"
                        body="No remaining targets detected. Go enjoy the illusion of control."
                    />
                ) : (
                    <TabEmptyState
                        icon={listOutline}
                        title="Nothing to acquire"
                        body="Your list is empty. Tap + to add items, if your memory permits."
                    />
                ))}

            {activeItems.length > 0 && (
                <>
                    {showUnsureOnly && (
                        <div className="unsure-filter-banner">Showing unsure items only</div>
                    )}
                    {showUnsureOnly && displayedUncheckedItems.length === 0 ? (
                        <TabEmptyState
                            icon={helpCircleOutline}
                            title="Nothing unsure"
                            body="No unsure items left to reconcile. Suspiciously tidy."
                        />
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
 * Header/toolbar/FAB shell for a selected store — never itself suspends, so it (and the store
 * selector) stay visible while ShoppingListBody's own Suspense boundary shows the list skeleton
 * for a not-yet-loaded store.
 *
 * The header's snoozed-items toggle and progress line derive from the list data *here*, during
 * this component's own render, via a non-suspending read of the same query cache the body uses
 * (`useShoppingListItemsIfLoaded`). Earlier versions instead had a child inside the boundary
 * compute these and report them upward through callbacks; that repeatedly produced a missing
 * snoozed toggle, because a child's write and this component's reset could land in either order
 * depending on whether the store's items happened to be cached. Deriving during render removes
 * the ordering question entirely — there is no cross-component state transfer left to race.
 * Keep it that way: don't reintroduce an onActionsChange-style callback from the body.
 */
const ShoppingListShell: React.FC<ShoppingListShellProps> = ({ storeId }) => {
    const { data: stores } = useStores();
    const multipleStores = stores && stores.length > 1;
    const { showSnoozed, toggleShowSnoozed } = useShowSnoozedItems();
    const { showUnsureOnly, toggleShowUnsureOnly } = useShowUnsureItems();
    const [isStoreItemsModalOpen, setIsStoreItemsModalOpen] = useState(false);

    // Same cache entry the body reads, minus the suspending — `[]` until it lands.
    const items = useShoppingListItemsIfLoaded(storeId);

    const { currentlySnoozedItemCount, activeItems } = useSnoozePartition(items, showSnoozed);

    const tripProgress = useMemo(() => computeTripProgress(activeItems), [activeItems]);

    const unsureCount = useMemo(() => activeItems.filter(isPendingUnsure).length, [activeItems]);

    const headerActions = useMemo<GlobalActionConfig[]>(() => {
        const result: GlobalActionConfig[] = [
            {
                id: "quick-add-store-items",
                icon: listOutline,
                title: "Quick add store items",
                ariaLabel: "Open store items quick-add modal",
                onClick: () => setIsStoreItemsModalOpen(true),
            },
        ];

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

    return (
        <RefreshConfig queryKeys={[queryKeys.shoppingListItems.byStore(storeId)]}>
            <AppHeader
                title="Shopping List"
                subToolbar={multipleStores ? <StoreSelector /> : undefined}
                progress={tripProgress}
            >
                <GlobalActions showKeepAwake={KEEP_AWAKE_BUTTON_ENABLED} actions={headerActions} />
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
                <IonContent fullscreen className="shopping-list-content">
                    <TabEmptyState
                        variant="full"
                        icon={storefrontOutline}
                        title="No store selected"
                        body="Pick a store, human. I cannot assist without data."
                    />
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
