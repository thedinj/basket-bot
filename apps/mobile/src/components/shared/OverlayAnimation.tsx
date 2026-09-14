import type React from "react";
import "./OverlayAnimation.css";

interface OverlayAnimationProps {
    /** CSS class to apply for the animation (empty string = not visible) */
    cssClass: string;
}

/** Extra paintable surfaces beyond the root and its two pseudo-elements. */
const LAYER_COUNT = 3;

/**
 * Generic overlay animation component
 * Renders a fixed-position overlay that covers the entire viewport
 * Animation behavior is controlled by the applied CSS class
 *
 * The root plus its ::before/::after gives three surfaces, which is not enough for effects like
 * the MIRV salvo (six warheads) or the railgun (four brackets). The inert child layers below add
 * nine more, addressed with :nth-child(). An effect that ignores them pays nothing for them.
 */
export const OverlayAnimation: React.FC<OverlayAnimationProps> = ({ cssClass }) => {
    if (!cssClass) {
        return null;
    }

    return (
        <div className={`overlay-animation ${cssClass}`}>
            {Array.from({ length: LAYER_COUNT }, (_, i) => (
                <i key={i} className="overlay-animation__layer" />
            ))}
        </div>
    );
};
