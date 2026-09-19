import { IonIcon, IonItem, IonLabel } from "@ionic/react";
import clsx from "clsx";
import { star, starOutline } from "ionicons/icons";
import React from "react";
import type { StoreItemWithDetails } from "../../db/types";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import UnsureToggleButton from "../shared/UnsureToggleButton";

import "./StoreItemRow.scss";

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
 * A store item row, on the shopping list's geometry: the favorite star in the checkbox column,
 * the name where a list item's name sits, and the same include/unsure toggle pair used on the
 * recipe/routing screens (see IncludeToggleButton/UnsureToggleButton) at the row's end.
 * Tapping anywhere else on the row opens the editor. Used in StoreItemsManagementModal.
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

    // The row edits; its buttons (star, cart, unsure) keep their taps to themselves.
    const handleRowClick = (e: React.MouseEvent) => {
        if (e.target instanceof Element && e.target.closest("button, ion-button")) return;
        onEditItem?.(item);
    };

    return (
        <IonItem
            button={false}
            className={clsx("store-item-row", onEditItem && "store-item-row--editable")}
            onClick={handleRowClick}
        >
            <div slot="start" className="store-item-row__fav">
                <button
                    type="button"
                    className={clsx(
                        "store-item-row__fav-hit",
                        isFavorite && "store-item-row__fav-hit--on"
                    )}
                    onClick={() => onToggleFavorite(item)}
                    aria-pressed={isFavorite}
                    aria-label={`Favorite ${item.name}`}
                >
                    <IonIcon icon={isFavorite ? star : starOutline} aria-hidden="true" />
                </button>
            </div>
            <IonLabel className="store-item-row__label">
                <h2 className="store-item-row__name">{item.name}</h2>
            </IonLabel>
            <div slot="end" className="store-item-row__toggles">
                <IncludeToggleButton
                    included={isInShoppingList}
                    onClick={() =>
                        isInShoppingList
                            ? onRemoveFromShoppingList(item)
                            : onAddToShoppingList(item)
                    }
                    label={item.name}
                />
                <UnsureToggleButton
                    active={isUnsure}
                    onClick={() => onSetUnsure(item, !isUnsure)}
                />
            </div>
        </IonItem>
    );
};

export default StoreItemRow;
