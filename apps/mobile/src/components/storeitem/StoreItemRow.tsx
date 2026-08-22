import { IonButton, IonIcon, IonItem, IonLabel } from "@ionic/react";
import { cart, cartOutline, helpCircle, star, starOutline } from "ionicons/icons";
import type { StoreItemWithDetails } from "../../db/types";

interface StoreItemRowProps {
    item: StoreItemWithDetails;
    isInShoppingList: boolean;
    isUnsure: boolean;
    onToggleFavorite: (item: StoreItemWithDetails) => void | Promise<void>;
    onAddToShoppingList: (item: StoreItemWithDetails) => void | Promise<void>;
    onMarkUnsure: (item: StoreItemWithDetails) => void | Promise<void>;
    onRemoveFromShoppingList: (item: StoreItemWithDetails) => void | Promise<void>;
    onEditItem?: (item: StoreItemWithDetails) => void;
}

/**
 * Reusable store item row component
 * Displays store item with star (favorite), name, and a cart button that cycles through
 * three states as it's tapped: not in list -> in list -> unsure -> not in list.
 * Used in StoreItemsManagementModal
 */
const StoreItemRow: React.FC<StoreItemRowProps> = ({
    item,
    isInShoppingList,
    isUnsure,
    onToggleFavorite,
    onAddToShoppingList,
    onMarkUnsure,
    onRemoveFromShoppingList,
    onEditItem,
}) => {
    const isFavorite = item.isFavorite;

    const handleCartClick = () => {
        if (!isInShoppingList) {
            onAddToShoppingList(item);
        } else if (!isUnsure) {
            onMarkUnsure(item);
        } else {
            onRemoveFromShoppingList(item);
        }
    };

    const cartIcon = !isInShoppingList ? cartOutline : isUnsure ? helpCircle : cart;
    const cartColor = !isInShoppingList ? "medium" : isUnsure ? "warning" : "primary";

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
            <IonButton slot="end" fill="clear" onClick={handleCartClick}>
                <IonIcon icon={cartIcon} color={cartColor} />
            </IonButton>
        </IonItem>
    );
};

export default StoreItemRow;
