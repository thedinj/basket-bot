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
import { add, closeOutline } from "ionicons/icons";
import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useStore, useStoreItemsWithDetails } from "../../db/hooks";
import { StoreItemWithDetails } from "../../db/types";
import RefreshConfig from "../../hooks/refresh/RefreshConfig";
import { useToast } from "../../hooks/useToast";
import { GlobalActions } from "../layout/GlobalActions";
import { FabSpacer } from "../shared/FabSpacer";
import { GroupedItemList } from "../shared/GroupedItemList";
import { ItemGroup } from "../shared/grouping.types";
import { createAisleSectionGroups } from "../shared/grouping.utils";
import PullToRefresh from "../shared/PullToRefresh";
import { StoreItemEditorModal } from "../storeitem/StoreItemEditorModal";
import StoreItemRow from "../storeitem/StoreItemRow";
import { useShoppingListItemMap } from "../storeitem/useShoppingListItemMap";
import { useStoreItemOperations } from "../storeitem/useStoreItemOperations";

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
    const { handleToggleFavorite, handleAddToShoppingList, handleRemoveFromShoppingList } =
        useStoreItemOperations(storeId);
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

    // Filter and split items into favorites and regular, then create groups
    const { favoriteGroups, regularGroups } = useMemo(() => {
        if (!items) return { favoriteGroups: [], regularGroups: [] };

        let filtered = items;
        if (debouncedSearchTerm.trim()) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            filtered = items.filter((item) => item.name.toLowerCase().includes(lowerSearch));
        }

        const favorites = filtered.filter((item) => item.isFavorite);
        const regular = filtered.filter((item) => !item.isFavorite);

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
        const regularGroups: ItemGroup<StoreItemWithDetails>[] =
            regular.length > 0
                ? createAisleSectionGroups(regular, {
                      showAisleHeaders: true,
                      showSectionHeaders: true,
                      sortOrderOffset: 0,
                      sectionIndentLevel: 16,
                  })
                : [];

        return { favoriteGroups, regularGroups };
    }, [items, debouncedSearchTerm]);

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
        setEditingItem(null);
    }, []);

    const confirmRemoveFromShoppingList = useCallback(
        (item: StoreItemWithDetails) => {
            const shoppingListItemId = shoppingListItemMap.get(item.id);
            if (!shoppingListItemId) return;

            setRemoveFromListAlert({
                itemId: item.id,
                itemName: item.name,
                shoppingListItemId,
            });
        },
        [shoppingListItemMap]
    );

    const executeRemoveFromShoppingList = useCallback(async () => {
        if (!removeFromListAlert) return;

        await handleRemoveFromShoppingList(removeFromListAlert.shoppingListItemId);
        setRemoveFromListAlert(null);
    }, [removeFromListAlert, handleRemoveFromShoppingList]);

    const renderItem = useCallback(
        (item: StoreItemWithDetails) => {
            const isInShoppingList = shoppingListItemMap.has(item.id);

            return (
                <StoreItemRow
                    key={item.id}
                    item={item}
                    isInShoppingList={isInShoppingList}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToShoppingList={handleAddToShoppingList}
                    onRemoveFromShoppingList={(item) => confirmRemoveFromShoppingList(item)}
                    onEditItem={openEditModal}
                />
            );
        },
        [
            shoppingListItemMap,
            handleToggleFavorite,
            handleAddToShoppingList,
            confirmRemoveFromShoppingList,
            openEditModal,
        ]
    );

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
                    ["stores", storeId],
                    ["items", "with-details", storeId],
                    ["shopping-list-items", storeId],
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
                <IonContent fullscreen>
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
                    ) : favoriteGroups.length === 0 && regularGroups.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center" }}>
                            <IonText color="medium">
                                {items?.length === 0 ? (
                                    <>
                                        No items yet. Add items to track products and their
                                        locations in this store.
                                    </>
                                ) : (
                                    <>No items match your search.</>
                                )}
                            </IonText>
                        </div>
                    ) : (
                        <>
                            {favoriteGroups.length > 0 && (
                                <>
                                    <IonItemDivider sticky>
                                        <IonLabel>
                                            <strong>Favorites</strong>
                                        </IonLabel>
                                    </IonItemDivider>
                                    <GroupedItemList<StoreItemWithDetails>
                                        groups={favoriteGroups}
                                        renderItem={renderItem}
                                    />
                                </>
                            )}

                            {regularGroups.length > 0 && (
                                <>
                                    {favoriteGroups.length > 0 && (
                                        <>
                                            <div style={{ height: "16px" }} />
                                            <IonItemDivider sticky>
                                                <IonLabel>
                                                    <strong>Other Items</strong>
                                                </IonLabel>
                                            </IonItemDivider>
                                        </>
                                    )}
                                    <GroupedItemList<StoreItemWithDetails>
                                        groups={regularGroups}
                                        renderItem={renderItem}
                                    />
                                </>
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
                        storeId={storeId}
                        editingItem={editingItem}
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
        <IonContent fullscreen>
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
