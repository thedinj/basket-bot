import type { RecipeTag } from "@basket-bot/core";
import { IonChip, IonLabel } from "@ionic/react";

import "./TagChip.scss";

interface TagChipProps {
    tag: RecipeTag;
    selected?: boolean;
    onClick?: () => void;
    size?: "sm" | "md";
}

/** A tag in its palette color. Carries no margin: the list it sits in spaces it with `gap`. */
const TagChip: React.FC<TagChipProps> = ({ tag, selected, onClick, size = "sm" }) => {
    const key = tag.colorKey ?? "violet";

    return (
        <IonChip
            className={`tag-chip tag-chip--${size}${selected === false ? " tag-chip--off" : ""}`}
            style={
                {
                    "--tag-bg": `var(--tag-${key}-bg)`,
                    "--tag-border": `var(--tag-${key}-border)`,
                    "--tag-text": `var(--tag-${key}-text)`,
                } as React.CSSProperties
            }
            onClick={onClick}
        >
            <IonLabel>{tag.name}</IonLabel>
        </IonChip>
    );
};

export default TagChip;
