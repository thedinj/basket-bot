import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSearchbar,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useStoreItemsWithDetails } from "../../db/hooks";
import type { StoreItemWithDetails } from "../../db/types";
import { GroupedItemList } from "../shared/GroupedItemList";
import { createAisleSectionGroups } from "../shared/grouping.utils";
import RemoveFromShoppingListAlert from "../shared/RemoveFromShoppingListAlert";
import StoreItemRow from "../storeitem/StoreItemRow";
import { useShoppingListItemMap } from "../storeitem/useShoppingListItemMap";
import { useStoreItemOperations } from "../storeitem/useStoreItemOperations";

interface FavoritesModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
}

/**
 * Quick Add Favorites modal
 * Shows favorite items from current store with ability to:
 * - Toggle favorite status
 * - Add/remove from shopping list
 * - Search favorites
 * - Bulk add all favorites not in shopping list
 */
const FavoritesModal: React.FC<FavoritesModalProps> = ({ isOpen, onClose, storeId }) => {
    const { data: items, isLoading } = useStoreItemsWithDetails(storeId);
    const shoppingListItemMap = useShoppingListItemMap(storeId);
    const { handleToggleFavorite, handleAddToShoppingList, handleRemoveFromShoppingList } =
        useStoreItemOperations(storeId);

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

    // Callback for search input
    const handleSearchInput = useCallback((e: CustomEvent) => {
        setSearchTerm(e.detail.value || "");
    }, []);
    const [removeFromListAlert, setRemoveFromListAlert] = useState<{
        itemId: string;
        itemName: string;
        shoppingListItemId: string;
    } | null>(null);

    // Filter favorites only
    const favoriteGroups = useMemo(() => {
        if (!items) return [];

        let filtered = items.filter((item) => item.isFavorite);

        if (debouncedSearchTerm.trim()) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter((item) => item.name.toLowerCase().includes(lowerSearch));
        }

        return filtered.length > 0
            ? createAisleSectionGroups(filtered, {
                  showAisleHeaders: true,
                  showSectionHeaders: true,
                  sortOrderOffset: 0,
                  sectionIndentLevel: 16,
              })
            : [];
    }, [items, debouncedSearchTerm]);

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

    const executeRemove = useCallback(async () => {
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
                    // No edit callback - tapping name does nothing in favorites modal
                />
            );
        },
        [
            shoppingListItemMap,
            handleToggleFavorite,
            handleAddToShoppingList,
            confirmRemoveFromShoppingList,
        ]
    );

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Quick Add Favorites</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                <IonSearchbar
                    value={searchTerm}
                    onIonInput={handleSearchInput}
                    placeholder="Search favorites..."
                    debounce={200}
                />
                {isLoading ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>
                        <IonText color="medium">Loading favorites...</IonText>
                    </div>
                ) : favoriteGroups.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>
                        <IonText color="medium">
                            {items?.some((i) => i.isFavorite) ? (
                                <>No favorites match your search.</>
                            ) : (
                                <>No favorites yet. Star items to add them here for quick access.</>
                            )}
                        </IonText>
                    </div>
                ) : (
                    <GroupedItemList<StoreItemWithDetails>
                        groups={favoriteGroups}
                        renderItem={renderItem}
                    />
                )}

                {/* Remove from list confirmation */}
                <RemoveFromShoppingListAlert
                    isOpen={!!removeFromListAlert}
                    itemName={removeFromListAlert?.itemName}
                    onCancel={() => setRemoveFromListAlert(null)}
                    onRemove={executeRemove}
                />
            </IonContent>
        </IonModal>
    );
};

export default FavoritesModal;
