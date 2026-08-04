import { IonIcon, IonToggle } from "@ionic/react";
import clsx from "clsx";

import "./ItemFlagTile.css";

interface ItemFlagTileProps {
    icon?: string | undefined;
    src?: string | undefined;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    tone: "warning" | "secondary";
}

export const ItemFlagTile = ({
    icon,
    src,
    label,
    description,
    checked,
    onChange,
    tone,
}: ItemFlagTileProps) => {
    return (
        <div
            className={clsx(
                "item-flag-tile",
                `item-flag-tile--${tone}`,
                checked && "item-flag-tile--active"
            )}
            role="switch"
            aria-checked={checked}
            aria-label={description}
            title={description}
            onClick={() => onChange(!checked)}
        >
            <IonIcon icon={icon} src={src} className="item-flag-tile__icon" />
            <span className="item-flag-tile__label">{label}</span>
            <IonToggle
                checked={checked}
                color={tone}
                style={{ pointerEvents: "none" }}
                className="item-flag-tile__toggle"
            />
        </div>
    );
};
