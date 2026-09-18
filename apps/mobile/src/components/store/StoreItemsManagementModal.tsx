import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonList,
    IonModal,
    IonSearchbar,
    IonSkeletonText,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import clsx from "clsx";
import {
    add,
    closeOutline,
    nuclear,
    pricetagsOutline,
    searchOutline,
    star,
    fileTrayFull,
} from "ionicons/icons";
import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useStore, useStoreItemsWithDetails } from "../../db/hooks";
import { queryKeys } from "../../db/queryKeys";
import { StoreItemWithDetails } from "../../db/types";
import RefreshConfig from "../../hooks/refresh/RefreshConfig";
import { useToast } from "../../hooks/useToast";
import { GlobalActions } from "../layout/GlobalActions";
import ActionSlotButton from "../shared/ActionSlotButton";
import { FabSpacer } from "../shared/FabSpacer";
import { GroupedItemList } from "../shared/GroupedItemList";
import { ItemGroup } from "../shared/grouping.types";
import { createAisleSectionGroups } from "../shared/grouping.utils";
import PullToRefresh from "../shared/PullToRefresh";
import TabEmptyState from "../shared/TabEmptyState";
import ObliterateUnusedModal from "../storeitem/ObliterateUnusedModal";
import { StoreItemEditorModal } from "../storeitem/StoreItemEditorModal";
import StoreItemRow from "../storeitem/StoreItemRow";
import { useShoppingListItemMap } from "../storeitem/useShoppingListItemMap";
import { useStoreItemOperations } from "../storeitem/useStoreItemOperations";
import { ItemsBlockHeader } from "./ItemsBlockHeader";

interface StoreItemsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
}

interface StoreItemsManagementModalContentProps {
    onClose: () => void;
    storeId: string;
}

const StoreItemsManagementModalContent: React.FC<StoreItemsManagementModalContentProps> = ({
    onClose,
    storeId,
}) => {
    const { data: store, isLoading: storeLoading } = useStore(storeId);
    const { data: items, isLoading } = useStoreItemsWithDetails(storeId);
    const shoppingListItemMap = useShoppingListItemMap(storeId);
    const {
        handleToggleFavorite,
        handleAddToShoppingList,
        handleMarkUnsure,
        handleRemoveFromShoppingList,
    } = useStoreItemOperations(storeId);
    const { showError } = useToast();

    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<StoreItemWithDetails | null>(null);
    const [removeFromListAlert, setRemoveFromListAlert] = useState<{
        itemId: string;
        itemName: string;
        shoppingListItemId: string;
    } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const [isObliterateModalOpen, setIsObliterateModalOpen] = useState(false);

    const openObliterateModal = useCallback(() => setIsObliterateModalOpen(true), []);
    const closeObliterateModal = useCallback(() => setIsObliterateModalOpen(false), []);

    // Filter and split items into favorites and all, then create groups
    const { favoriteGroups, allGroups, favoriteCount, allCount } = useMemo(() => {
        if (!items) return { favoriteGroups: [], allGroups: [], favoriteCount: 0, allCount: 0 };

        let filtered = items;
        if (debouncedSearchTerm.trim()) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            filtered = items.filter((item) => item.name.toLowerCase().includes(lowerSearch));
        }

        const favorites = filtered.filter((item) => item.isFavorite);
        const all = filtered; // Used to be: filtered.filter((item) => !item.isFavorite);

        // Favorites groups organized by aisle/section
        const favoriteGroups: ItemGroup<StoreItemWithDetails>[] =
            favorites.length > 0
                ? createAisleSectionGroups(favorites, {
                      showAisleHeaders: true,
                      showSectionHeaders: true,
                      sortOrderOffset: 0,
                      sectionIndentLevel: 16,
                  })
                : [];

        // Regular items organized by aisle/section
        const allGroups: ItemGroup<StoreItemWithDetails>[] =
            all.length > 0
                ? createAisleSectionGroups(all, {
                      showAisleHeaders: true,
                      showSectionHeaders: true,
                      sortOrderOffset: 0,
                      sectionIndentLevel: 16,
                  })
                : [];

        // Offer "Obliterate Unused" on the Uncategorized divider, mirroring the shopping
        // list's header actions. The count here is only a gate on *showing* the button —
        // the authoritative set is computed server-side in the preview sheet, because this
        // client cannot see other members' private shopping-list rows. Hidden while a search
        // is active: the header would then sit over a filtered subset while the action still
        // targets every orphan in the store.
        const uncategorized = allGroups.find((group) => group.id === "aisle-null");
        if (uncategorized?.header && !debouncedSearchTerm.trim()) {
            const uncategorizedItems = [
                ...uncategorized.items,
                ...(uncategorized.children ?? []).flatMap((child) => child.items),
            ];
            const likelyUnused = uncategorizedItems.filter(
                (item) => !item.isFavorite && !shoppingListItemMap.has(item.id)
            ).length;

            if (likelyUnused > 0) {
                uncategorized.header.actionSlot = (
                    <ActionSlotButton
                        label="Obliterate Unused"
                        icon={nuclear}
                        onClick={openObliterateModal}
                    />
                );
            }
        }

        return {
            favoriteGroups,
            allGroups,
            favoriteCount: favorites.length,
            allCount: all.length,
        };
    }, [items, debouncedSearchTerm, shoppingListItemMap, openObliterateModal]);

    const openCreateModal = useCallback(() => {
        setEditingItem(null);
        setIsEditorModalOpen(true);
    }, []);

    const openEditModal = useCallback((item: StoreItemWithDetails) => {
        setEditingItem(item);
        setIsEditorModalOpen(true);
    }, []);

    const closeEditorModal = useCallback(() => {
        setIsEditorModalOpen(false);
    }, []);

    const handleEditorDismissed = useCallback(() => {
        setEditingItem(null);
    }, []);

    const confirmRemoveFromShoppingList = useCallback(
        (item: StoreItemWithDetails) => {
            const shoppingListItem = shoppingListItemMap.get(item.id);
            if (!shoppingListItem) return;

            setRemoveFromListAlert({
                itemId: item.id,
                itemName: item.name,
                shoppingListItemId: shoppingListItem.id,
            });
        },
        [shoppingListItemMap]
    );

    const executeRemoveFromShoppingList = useCallback(async () => {
        if (!removeFromListAlert) return;

        await handleRemoveFromShoppingList(removeFromListAlert.shoppingListItemId);
        setRemoveFromListAlert(null);
    }, [removeFromListAlert, handleRemoveFromShoppingList]);

    const handleSetItemUnsure = useCallback(
        (item: StoreItemWithDetails, isUnsure: boolean) => {
            const shoppingListItem = shoppingListItemMap.get(item.id);
            if (!shoppingListItem) {
                return handleAddToShoppingList(item, { isUnsure });
            }

            return handleMarkUnsure(shoppingListItem, isUnsure);
        },
        [shoppingListItemMap, handleAddToShoppingList, handleMarkUnsure]
    );

    const renderItem = useCallback(
        (item: StoreItemWithDetails) => {
            const shoppingListItem = shoppingListItemMap.get(item.id);

            return (
                <StoreItemRow
                    key={item.id}
                    item={item}
                    isInShoppingList={!!shoppingListItem}
                    isUnsure={!!shoppingListItem?.isUnsure}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToShoppingList={handleAddToShoppingList}
                    onSetUnsure={handleSetItemUnsure}
                    onRemoveFromShoppingList={(item) => confirmRemoveFromShoppingList(item)}
                    onEditItem={openEditModal}
                />
            );
        },
        [
            shoppingListItemMap,
            handleToggleFavorite,
            handleAddToShoppingList,
            handleSetItemUnsure,
            confirmRemoveFromShoppingList,
            openEditModal,
        ]
    );

    const getItemKey = useCallback((item: StoreItemWithDetails) => item.id, []);

    // Handle deleted/non-existent store
    if (!storeLoading && !store) {
        showError("Store not found or no longer available.");
        onClose();
        return null;
    }

    return (
        <>
            <RefreshConfig
                queryKeys={[
                    queryKeys.stores.detail(storeId),
                    queryKeys.items.withDetails(storeId),
                    queryKeys.shoppingListItems.byStore(storeId),
                ]}
            >
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>{store?.name || "Store"} Items</IonTitle>
                        <IonButtons slot="end">
                            <GlobalActions />
                            <IonButton onClick={onClose}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    <PullToRefresh />
                    <IonSearchbar
                        value={searchTerm}
                        onIonInput={(e) => setSearchTerm(e.detail.value || "")}
                        placeholder="Search items..."
                        debounce={0}
                    />
                    {isLoading ? (
                        <div style={{ padding: "20px", textAlign: "center" }}>
                            <IonText color="medium">Loading items...</IonText>
                        </div>
                    ) : favoriteGroups.length === 0 && allGroups.length === 0 ? (
                        items?.length === 0 ? (
                            <TabEmptyState
                                icon={pricetagsOutline}
                                title="No items yet"
                                body="Add items to track products and their locations in this store."
                            />
                        ) : (
                            <TabEmptyState
                                icon={searchOutline}
                                title="No matches"
                                body="No items match your search. Try fewer letters."
                            />
                        )
                    ) : (
                        <>
                            {favoriteGroups.length > 0 && (
                                <div className="store-items-block store-items-block--headed">
                                    <ItemsBlockHeader
                                        icon={star}
                                        label="Favorites"
                                        count={favoriteCount}
                                    />
                                    <GroupedItemList<StoreItemWithDetails>
                                        groups={favoriteGroups}
                                        renderItem={renderItem}
                                        getItemKey={getItemKey}
                                    />
                                </div>
                            )}

                            {allGroups.length > 0 && (
                                <div
                                    className={clsx(
                                        "store-items-block",
                                        favoriteGroups.length > 0 && "store-items-block--headed"
                                    )}
                                >
                                    {/* Only needs a name when there's a Favorites block to tell
                                        it apart from. */}
                                    {favoriteGroups.length > 0 && (
                                        <ItemsBlockHeader
                                            icon={fileTrayFull}
                                            iconColor="medium"
                                            label="All Items"
                                            count={allCount}
                                        />
                                    )}
                                    <GroupedItemList<StoreItemWithDetails>
                                        groups={allGroups}
                                        renderItem={renderItem}
                                        getItemKey={getItemKey}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <FabSpacer />

                    <IonFab slot="fixed" vertical="bottom" horizontal="end">
                        <IonFabButton onClick={openCreateModal}>
                            <IonIcon icon={add} />
                        </IonFabButton>
                    </IonFab>

                    <StoreItemEditorModal
                        isOpen={isEditorModalOpen}
                        onClose={closeEditorModal}
                        onDismissed={handleEditorDismissed}
                        storeId={storeId}
                        editingItem={editingItem}
                    />

                    <ObliterateUnusedModal
                        isOpen={isObliterateModalOpen}
                        onClose={closeObliterateModal}
                        storeId={storeId}
                    />

                    <IonAlert
                        isOpen={!!removeFromListAlert}
                        onDidDismiss={() => setRemoveFromListAlert(null)}
                        header="Remove from Shopping List?"
                        message={
                            removeFromListAlert
                                ? `Remove "${removeFromListAlert.itemName}" from your shopping list?`
                                : ""
                        }
                        buttons={[
                            {
                                text: "Cancel",
                                role: "cancel",
                            },
                            {
                                text: "Remove",
                                role: "destructive",
                                handler: executeRemoveFromShoppingList,
                            },
                        ]}
                    />
                </IonContent>
            </RefreshConfig>
        </>
    );
};

const LoadingFallback: React.FC = () => (
    <>
        <IonHeader>
            <IonToolbar>
                <IonTitle>
                    <IonSkeletonText animated style={{ width: "140px" }} />
                </IonTitle>
            </IonToolbar>
        </IonHeader>
        <IonContent>
            <IonSearchbar disabled value="" placeholder="Search items..." />
            <IonItemDivider>
                <IonLabel>
                    <IonSkeletonText animated style={{ width: "80px" }} />
                </IonLabel>
            </IonItemDivider>
            <IonList>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <IonItem key={i}>
                        <IonLabel>
                            <IonSkeletonText animated style={{ width: "70%" }} />
                            <IonSkeletonText animated style={{ width: "40%" }} />
                        </IonLabel>
                    </IonItem>
                ))}
            </IonList>
        </IonContent>
    </>
);

const StoreItemsManagementModal: React.FC<StoreItemsManagementModalProps> = ({
    isOpen,
    onClose,
    storeId,
}) => {
    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            {storeId && (
                <Suspense fallback={<LoadingFallback />}>
                    <StoreItemsManagementModalContent storeId={storeId} onClose={onClose} />
                </Suspense>
            )}
        </IonModal>
    );
};

export default StoreItemsManagementModal;
