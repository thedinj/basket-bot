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
    tone: "warning" | "secondary" | "classified";
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

    const activate = (event: React.MouseEvent | React.KeyboardEvent) => {
        if (disabled) {
            // The disabled-tap explainer takes a mouse event; a keypress has nothing to anchor
            // a popover to, so it only acts on taps.
            if (event.type === "click") onDisabledTap?.(event as React.MouseEvent);
            return;
        }
        onChange(!checked);
    };

    return (
        // The tile is the switch: focusable, toggled by tap, Space or Enter. The IonToggle
        // inside only draws the state, so it is hidden from focus and assistive tech.
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
            tabIndex={0}
            onClick={activate}
            onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    activate(event);
                }
            }}
        >
            <IonIcon icon={icon} src={src} className="item-flag-tile__icon" />
            <span className="item-flag-tile__label">{label}</span>
            {disabled && <IonIcon icon={lockClosedOutline} className="item-flag-tile__lock-icon" />}
            {/* `tone` doubles as an Ionic colour name for the two that are one. "classified"
                is not — it is the dossier's own paper and ink — so the toggle takes its
                colours from the tile's CSS instead (ItemFlagTile.css). Passing it as a colour
                made Ionic look up a palette that does not exist, and the switch rendered
                fully transparent. */}
            <IonToggle
                checked={checked}
                color={tone === "classified" ? undefined : tone}
                disabled={disabled}
                className="item-flag-tile__toggle"
                aria-hidden="true"
                tabIndex={-1}
            />
        </div>
    );
};
