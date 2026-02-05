import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import {
    IonAlert,
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonPage,
    IonSearchbar,
    IonText,
} from "@ionic/react";
import { add, cart, cartOutline, star, starOutline } from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { AppHeader } from "../components/layout/AppHeader";
import { FabSpacer } from "../components/shared/FabSpacer";
import { GroupedItemList } from "../components/shared/GroupedItemList";
import { ItemGroup } from "../components/shared/grouping.types";
import { createAisleSectionGroups } from "../components/shared/grouping.utils";
import { StoreItemEditorModal } from "../components/storeitem/StoreItemEditorModal";
import {
    useRemoveShoppingListItem,
    useShoppingListItems,
    useStore,
    useStoreItemsWithDetails,
    useToggleFavorite,
    useUpsertShoppingListItem,
} from "../db/hooks";
import { StoreItemWithDetails } from "../db/types";
import { useToast } from "../hooks/useToast";

const StoreItemsPage: React.FC = () => {
    useRenderStormDetector("StoreItemsPage");
    const { id: storeId } = useParams<{ id: string }>();
    const history = useHistory();
    const { data: store, isLoading: storeLoading } = useStore(storeId);
    const { data: items, isLoading } = useStoreItemsWithDetails(storeId);
    const { data: shoppingListItems } = useShoppingListItems(storeId);
    const toggleFavorite = useToggleFavorite();
    const upsertShoppingListItem = useUpsertShoppingListItem();
    const removeShoppingListItem = useRemoveShoppingListItem();
    const { showSuccess, showError } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<StoreItemWithDetails | null>(null);
    const [removeFromListAlert, setRemoveFromListAlert] = useState<{
        itemId: string;
        itemName: string;
        shoppingListItemId: string;
    } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

    // Create a map of storeItemId -> shopping_list_item for quick lookups
    const shoppingListItemMap = useMemo(() => {
        const map = new Map<string, string>();
        if (shoppingListItems) {
            for (const item of shoppingListItems) {
                // Skip ideas (they have null storeItemId)
                if (item.storeItemId) {
                    map.set(item.storeItemId, item.id);
                }
            }
        }
        return map;
    }, [shoppingListItems]);

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
        setIsModalOpen(true);
    }, []);

    const openEditModal = useCallback((item: StoreItemWithDetails) => {
        setEditingItem(item);
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingItem(null);
    }, []);

    const handleToggleFavorite = useCallback(
        async (item: StoreItemWithDetails) => {
            try {
                await toggleFavorite.mutateAsync({
                    id: item.id,
                    storeId: storeId,
                });
            } catch {
                showError("Failed to update favorite");
            }
        },
        [storeId, showError, toggleFavorite]
    );

    const handleAddToShoppingList = useCallback(
        async (item: StoreItemWithDetails) => {
            try {
                await upsertShoppingListItem.mutateAsync({
                    storeId: storeId,
                    storeItemId: item.id,
                });
                showSuccess("Added to shopping list");
            } catch {
                showError("Failed to add to shopping list");
            }
        },
        [storeId, upsertShoppingListItem, showSuccess, showError]
    );

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

        try {
            await removeShoppingListItem.mutateAsync({
                id: removeFromListAlert.shoppingListItemId,
                storeId: storeId,
            });
            showSuccess("Removed from shopping list");
            setRemoveFromListAlert(null);
        } catch {
            showError("Failed to remove from shopping list");
        }
    }, [removeFromListAlert, removeShoppingListItem, showError, showSuccess, storeId]);

    const renderItem = useCallback(
        (item: StoreItemWithDetails) => {
            const isInShoppingList = shoppingListItemMap.has(item.id);
            const isFavorite = item.isFavorite;

            return (
                <IonItem key={item.id}>
                    <div
                        slot="start"
                        style={{
                            cursor: "pointer",
                        }}
                        onClick={() => handleToggleFavorite(item)}
                    >
                        <IonIcon
                            icon={isFavorite ? star : starOutline}
                            color={isFavorite ? "warning" : "medium"}
                        />
                    </div>
                    <IonLabel style={{ cursor: "pointer" }} onClick={() => openEditModal(item)}>
                        {item.name}
                    </IonLabel>
                    <IonButton
                        slot="end"
                        fill="clear"
                        onClick={() =>
                            isInShoppingList
                                ? confirmRemoveFromShoppingList(item)
                                : handleAddToShoppingList(item)
                        }
                    >
                        <IonIcon
                            icon={isInShoppingList ? cart : cartOutline}
                            color={isInShoppingList ? "primary" : "medium"}
                        />
                    </IonButton>
                    {/* <IonButton
                    slot="end"
                    fill="clear"
                    onClick={() => openEditModal(item)}
                >
                    <IonIcon icon={create} color="medium" />
                </IonButton> */}
                </IonItem>
            );
        },
        [
            confirmRemoveFromShoppingList,
            handleAddToShoppingList,
            handleToggleFavorite,
            openEditModal,
            shoppingListItemMap,
        ]
    );

    // Handle deleted/non-existent store
    if (!storeLoading && !store) {
        showError("Store not found or no longer available.");
        history.replace("/stores");
        return null;
    }

    return (
        <IonPage>
            <AppHeader
                title={`${store?.name || "Store"} Items`}
                showBackButton
                backButtonHref={`/stores/${encodeURIComponent(storeId)}`}
            />
            <IonContent fullscreen>
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
                                    No items yet. Add items to track products and their locations in
                                    this store.
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
                    isOpen={isModalOpen}
                    onClose={closeModal}
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
        </IonPage>
    );
};

export default StoreItemsPage;
