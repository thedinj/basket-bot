import { IonIcon } from "@ionic/react";
import { closeOutline } from "ionicons/icons";

type RowRemoveButtonProps = {
    onClick: () => void;
    /** Names what goes: "Remove Ana", "Delete tag Vegan". */
    label: string;
    disabled?: boolean;
};

/**
 * Removes one row from a list (a member, an invitation, a tag, an ingredient): a quiet 36px ×
 * at the row's end, medium until pressed, then danger. Its glyph is pulled onto the row's end
 * inset by the caller's layout (margin-inline-end: -8px). Styles: theme/patterns.scss
 * (.row-remove).
 */
export const RowRemoveButton: React.FC<RowRemoveButtonProps> = ({ onClick, label, disabled }) => (
    <button
        type="button"
        className="row-remove"
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        disabled={disabled}
        aria-label={label}
    >
        <IonIcon icon={closeOutline} aria-hidden="true" />
    </button>
);
