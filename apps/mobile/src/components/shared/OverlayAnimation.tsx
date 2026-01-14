import type React from "react";
import "./OverlayAnimation.css";

interface OverlayAnimationProps {
    /** CSS class to apply for the animation (empty string = not visible) */
    cssClass: string;
}

/**
 * Generic overlay animation component
 * Renders a fixed-position overlay that covers the entire viewport
 * Animation behavior is controlled by the applied CSS class
 */
export const OverlayAnimation: React.FC<OverlayAnimationProps> = ({
    cssClass,
}) => {
    if (!cssClass) {
        return null;
    }

    return <div className={`overlay-animation ${cssClass}`} />;
};
