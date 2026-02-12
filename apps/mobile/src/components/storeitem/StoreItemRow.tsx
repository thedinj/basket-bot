import { IonButton, IonIcon, IonItem, IonLabel } from "@ionic/react";
import { cart, cartOutline, star, starOutline } from "ionicons/icons";
import type { StoreItemWithDetails } from "../../db/types";

interface StoreItemRowProps {
    item: StoreItemWithDetails;
    isInShoppingList: boolean;
    onToggleFavorite: (item: StoreItemWithDetails) => void | Promise<void>;
    onAddToShoppingList: (item: StoreItemWithDetails) => void | Promise<void>;
    onRemoveFromShoppingList: (item: StoreItemWithDetails) => void | Promise<void>;
    onEditItem?: (item: StoreItemWithDetails) => void;
}

/**
 * Reusable store item row component
 * Displays store item with star (favorite), name, and cart (add/remove from shopping list)
 * Used in StoreItemsPage and FavoritesModal
 */
const StoreItemRow: React.FC<StoreItemRowProps> = ({
    item,
    isInShoppingList,
    onToggleFavorite,
    onAddToShoppingList,
    onRemoveFromShoppingList,
    onEditItem,
}) => {
    const isFavorite = item.isFavorite;

    return (
        <IonItem key={item.id}>
            <div slot="start" style={{ cursor: "pointer" }} onClick={() => onToggleFavorite(item)}>
                <IonIcon
                    icon={isFavorite ? star : starOutline}
                    color={isFavorite ? "warning" : "medium"}
                />
            </div>
            <IonLabel
                style={{ cursor: onEditItem ? "pointer" : undefined }}
                onClick={() => onEditItem?.(item)}
            >
                {item.name}
            </IonLabel>
            <IonButton
                slot="end"
                fill="clear"
                onClick={() =>
                    isInShoppingList ? onRemoveFromShoppingList(item) : onAddToShoppingList(item)
                }
            >
                <IonIcon
                    icon={isInShoppingList ? cart : cartOutline}
                    color={isInShoppingList ? "primary" : "medium"}
                />
            </IonButton>
        </IonItem>
    );
};

export default StoreItemRow;
