import { IonIcon, IonItemDivider, IonLabel } from "@ionic/react";
import React from "react";
import "./ItemsBlockHeader.scss";

type ItemsBlockHeaderProps = {
    label: string;
    count: number;
    icon?: string;
    /** Ionic color for the icon; defaults to the favorites star's "warning". */
    iconColor?: string;
};

/**
 * Top-tier header for a block of grouped store items (Favorites / All Items). Pins to the top
 * of its block; the block's aisle headers pin directly beneath it (see ItemsBlockHeader.scss).
 */
export const ItemsBlockHeader: React.FC<ItemsBlockHeaderProps> = ({
    label,
    count,
    icon,
    iconColor = "warning",
}) => (
    <IonItemDivider sticky className="items-block-header">
        {icon && <IonIcon icon={icon} slot="start" color={iconColor} aria-hidden="true" />}
        <IonLabel>{label}</IonLabel>
        <span slot="end" className="items-block-header__count">
            {count}
        </span>
    </IonItemDivider>
);
