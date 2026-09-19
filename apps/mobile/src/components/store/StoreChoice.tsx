import { IonIcon } from "@ionic/react";
import { checkmarkCircle, ellipseOutline } from "ionicons/icons";
import { ReactNode } from "react";

import "./StoreSheets.scss";

type StoreChoiceProps = {
    title: string;
    description: string;
    /** Optional lilac tabular line under the description (e.g. "12 aisles · 30 sections"). */
    meta?: ReactNode;
    selected: boolean;
    onSelect: () => void;
};

/**
 * One radio row in a `.boxed-list` with `role="radiogroup"` (New Store's starting layout, Share
 * Store's household): the mark on the box's 12px inset, then the title, its explanation and an
 * optional meta line.
 */
const StoreChoice: React.FC<StoreChoiceProps> = ({
    title,
    description,
    meta,
    selected,
    onSelect,
}) => (
    <button
        type="button"
        role="radio"
        aria-checked={selected}
        className="row-button store-choice"
        onClick={onSelect}
    >
        <IonIcon
            className="store-choice__mark"
            icon={selected ? checkmarkCircle : ellipseOutline}
            aria-hidden="true"
        />
        <span className="store-choice__text">
            <span className="store-choice__title">{title}</span>
            <span className="store-choice__desc">{description}</span>
            {meta && <span className="store-choice__meta">{meta}</span>}
        </span>
    </button>
);

export default StoreChoice;
