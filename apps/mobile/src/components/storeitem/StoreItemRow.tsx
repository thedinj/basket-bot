import { IonIcon, IonItem, IonLabel } from "@ionic/react";
import { star, starOutline } from "ionicons/icons";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import UnsureToggleButton from "../shared/UnsureToggleButton";
import type { StoreItemWithDetails } from "../../db/types";

interface StoreItemRowProps {
    item: StoreItemWithDetails;
    isInShoppingList: boolean;
    isUnsure: boolean;
    onToggleFavorite: (item: StoreItemWithDetails) => void | Promise<void>;
    onAddToShoppingList: (item: StoreItemWithDetails) => void | Promise<void>;
    onSetUnsure: (item: StoreItemWithDetails, isUnsure: boolean) => void | Promise<void>;
    onRemoveFromShoppingList: (item: StoreItemWithDetails) => void | Promise<void>;
    onEditItem?: (item: StoreItemWithDetails) => void;
}

/**
 * Reusable store item row component.
 * Displays store item with star (favorite), name, and the same include/unsure toggle
 * pair used on the recipe/routing screens (see IncludeToggleButton/UnsureToggleButton).
 * Used in StoreItemsManagementModal.
 */
const StoreItemRow: React.FC<StoreItemRowProps> = ({
    item,
    isInShoppingList,
    isUnsure,
    onToggleFavorite,
    onAddToShoppingList,
    onSetUnsure,
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
            <IncludeToggleButton
                included={isInShoppingList}
                onClick={() =>
                    isInShoppingList ? onRemoveFromShoppingList(item) : onAddToShoppingList(item)
                }
                label={item.name}
            />
            <UnsureToggleButton
                active={isUnsure}
                disabled={!isInShoppingList}
                onClick={() => onSetUnsure(item, !isUnsure)}
            />
        </IonItem>
    );
};

export default StoreItemRow;
