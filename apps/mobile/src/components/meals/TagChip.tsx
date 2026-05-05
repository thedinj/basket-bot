import type { RecipeTag } from "@basket-bot/core"
import { IonChip, IonLabel } from "@ionic/react"

interface TagChipProps {
    tag: RecipeTag
    selected?: boolean
    onClick?: () => void
    size?: "sm" | "md"
}

const TagChip: React.FC<TagChipProps> = ({ tag, selected, onClick, size = "sm" }) => {
    const key = tag.colorKey ?? "violet"
    const large = size === "md"

    return (
        <IonChip
            style={{
                background: `var(--tag-${key}-bg)`,
                border: `1px solid var(--tag-${key}-border)`,
                color: `var(--tag-${key}-text)`,
                opacity: selected === false ? 0.5 : 1,
                margin: "2px 4px 2px 0",
                height: large ? "26px" : "16px",
                minHeight: large ? "26px" : "16px",
                fontSize: large ? "12px" : "10px",
                fontWeight: large ? 500 : 600,
                padding: large ? "0 10px" : "0 6px",
                "--padding-top": "0px",
                "--padding-bottom": "0px",
            }}
            onClick={onClick}
        >
            <IonLabel style={{ color: `var(--tag-${key}-text)` }}>{tag.name}</IonLabel>
        </IonChip>
    )
}

export default TagChip
