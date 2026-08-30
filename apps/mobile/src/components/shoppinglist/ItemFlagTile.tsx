import { IonIcon, IonToggle } from "@ionic/react";
import clsx from "clsx";
import { lockClosedOutline } from "ionicons/icons";

import "./ItemFlagTile.css";

interface ItemFlagTileProps {
    icon?: string | undefined;
    src?: string | undefined;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    tone: "warning" | "secondary";
    disabled?: boolean;
    disabledMessage?: string;
    onDisabledTap?: (event: React.MouseEvent) => void;
}

export const ItemFlagTile = ({
    icon,
    src,
    label,
    description,
    checked,
    onChange,
    tone,
    disabled,
    disabledMessage,
    onDisabledTap,
}: ItemFlagTileProps) => {
    const effectiveDescription = disabled && disabledMessage ? disabledMessage : description;

    return (
        <div
            className={clsx(
                "item-flag-tile",
                `item-flag-tile--${tone}`,
                checked && "item-flag-tile--active",
                disabled && "item-flag-tile--disabled"
            )}
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            aria-label={effectiveDescription}
            title={effectiveDescription}
            onClick={(event) => {
                if (disabled) {
                    onDisabledTap?.(event);
                    return;
                }
                onChange(!checked);
            }}
        >
            <IonIcon icon={icon} src={src} className="item-flag-tile__icon" />
            <span className="item-flag-tile__label">{label}</span>
            {disabled && <IonIcon icon={lockClosedOutline} className="item-flag-tile__lock-icon" />}
            <IonToggle
                checked={checked}
                color={tone}
                disabled={disabled}
                style={{ pointerEvents: "none" }}
                className="item-flag-tile__toggle"
            />
        </div>
    );
};
