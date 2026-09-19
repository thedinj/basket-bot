import { IonIcon } from "@ionic/react";
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
 * Top-tier header for a block of grouped store items (Favorites / All Items): a ruled label on
 * the gutter with the block's count. Pins to the top of its block; the block's aisle bars pin
 * directly beneath it (see ItemsBlockHeader.scss).
 */
export const ItemsBlockHeader: React.FC<ItemsBlockHeaderProps> = ({
    label,
    count,
    icon,
    iconColor = "warning",
}) => (
    <h2 className="ruled-label items-block-header">
        {icon && (
            <IonIcon
                icon={icon}
                color={iconColor}
                className="items-block-header__icon"
                aria-hidden="true"
            />
        )}
        {label}
        <span className="ruled-label__count">{count}</span>
    </h2>
);
