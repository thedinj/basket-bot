import { AnimatePresence, AnimatePresenceProps, motion, useReducedMotion } from "motion/react";
import { ReactNode } from "react";

// Natural deceleration — confident, no overshoot
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

interface AnimatedGroupProps<T> {
    items: T[];
    getKey: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    mode?: AnimatePresenceProps["mode"];
}

/**
 * Wraps a set of items in AnimatePresence with slide + layout animations.
 * Items slide up into place on enter, slide up and out on exit. The `layout`
 * prop makes siblings smoothly reposition (move) when items are added/removed
 * rather than snapping into place. Respects prefers-reduced-motion.
 */
export const AnimatedGroup = <T,>({
    items,
    getKey,
    renderItem,
    mode = "popLayout",
}: AnimatedGroupProps<T>) => {
    const reducedMotion = useReducedMotion();

    return (
        <AnimatePresence mode={mode}>
            {items.map((item) => (
                <motion.div
                    key={getKey(item)}
                    layout={!reducedMotion}
                    initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={
                        reducedMotion
                            ? { opacity: 0, transition: { duration: 0.1 } }
                            : {
                                  opacity: 0,
                                  y: -6,
                                  transition: { duration: 0.16, ease: EASE_OUT_QUART },
                              }
                    }
                    transition={
                        reducedMotion
                            ? { duration: 0.15 }
                            : {
                                  opacity: { duration: 0.22, ease: EASE_OUT_QUART },
                                  y: { duration: 0.22, ease: EASE_OUT_QUART },
                                  layout: { duration: 0.2, ease: EASE_OUT_QUART },
                              }
                    }
                >
                    {renderItem(item)}
                </motion.div>
            ))}
        </AnimatePresence>
    );
};
