import type { RecipeTag } from "@basket-bot/core"
import TagChip from "./TagChip"

import "./TagChipList.scss"

interface TagChipListProps {
    tags: RecipeTag[]
    /** Caps visible chips; remaining shown as "+N". Omit to show all. */
    max?: number
    className?: string
    onClickTag?: (tag: RecipeTag) => void
    selectedTagId?: (id: string) => boolean
}

const TagChipList: React.FC<TagChipListProps> = ({
    tags,
    max,
    className,
    onClickTag,
    selectedTagId,
}) => {
    if (tags.length === 0) return null
    const visible = max != null ? tags.slice(0, max) : tags
    const overflow = max != null ? Math.max(0, tags.length - max) : 0

    return (
        <div className={`tag-chip-list${className ? ` ${className}` : ""}`}>
            {visible.map((tag) => (
                <TagChip
                    key={tag.id}
                    tag={tag}
                    selected={selectedTagId ? (selectedTagId(tag.id) ? undefined : false) : undefined}
                    onClick={onClickTag ? () => onClickTag(tag) : undefined}
                />
            ))}
            {overflow > 0 && (
                <span className="tag-chip-list__overflow">+{overflow}</span>
            )}
        </div>
    )
}

export default TagChipList
