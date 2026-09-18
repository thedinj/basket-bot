import clsx from "clsx";
import { CSSProperties, ReactNode } from "react";
import "./AislePlate.scss";

type AislePlateProps = {
    /** A number, an emoji, or an icon; empty string holds the plate's space without drawing it. */
    badge: ReactNode;
    /** How a text badge is drawn (see GroupHeader.badgeKind). Ignored for icon badges. */
    kind?: "code" | "emoji" | "sign";
    /** CSS color for an icon plate's outline and glyph (Ideas, Checked). */
    color?: string;
    /** Ionic slot, when the plate sits in an item's start slot. */
    slot?: string;
};

/**
 * The "shield" plate at the start of an aisle header: an aisle number, a monochrome emoji, an
 * "AISLE 3" sign, or an icon. Shared by the grouped shopping list and the aisle management list
 * so both show an aisle the same way.
 */
export const AislePlate: React.FC<AislePlateProps> = ({ badge, kind, color, slot }) => (
    <span
        slot={slot}
        className={clsx(
            "group-header-badge",
            !badge && "group-header-badge--empty",
            typeof badge === "string"
                ? `group-header-badge--${kind ?? "code"}`
                : "group-header-badge--icon"
        )}
        aria-hidden={!badge}
        style={color ? ({ "--badge-color": color } as CSSProperties) : undefined}
    >
        {kind === "sign" ? (
            <>
                <span className="group-header-badge__word">Aisle</span>
                <span className="group-header-badge__num">{badge}</span>
            </>
        ) : (
            badge
        )}
    </span>
);
