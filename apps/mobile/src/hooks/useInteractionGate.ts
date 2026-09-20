import { useEffect } from "react";
import { interactionGate } from "../utils/interactionGate";

/**
 * Feeds `interactionGate` from the document. Mounted once at the app root, because both of its
 * readers (live sync, and every animated list) can be anywhere in the tree.
 *
 * Listeners sit on the document in the capture phase, so a pointer that starts on a row is
 * seen whatever that row does with the event, and they are passive: this only observes.
 * `pointercancel` matters as much as `pointerup` — a touch that turns into a scroll ends as a
 * cancel, and without it the pointer count would never come back down.
 */
export const useInteractionGate = (): void => {
    useEffect(() => {
        const onDown = () => interactionGate.pointerDown();
        const onUp = () => interactionGate.pointerUp();
        const onMove = () => interactionGate.note();

        const options = { capture: true, passive: true } as const;
        document.addEventListener("pointerdown", onDown, options);
        document.addEventListener("pointerup", onUp, options);
        document.addEventListener("pointercancel", onUp, options);
        document.addEventListener("touchmove", onMove, options);
        document.addEventListener("scroll", onMove, options);

        return () => {
            document.removeEventListener("pointerdown", onDown, options);
            document.removeEventListener("pointerup", onUp, options);
            document.removeEventListener("pointercancel", onUp, options);
            document.removeEventListener("touchmove", onMove, options);
            document.removeEventListener("scroll", onMove, options);
            // Nothing is feeding the gate any more; leaving a pointer counted would hold
            // updates back for good.
            interactionGate.reset();
        };
    }, []);
};
