import { AnimatePresence, AnimatePresenceProps, motion } from "motion/react";
import { ReactNode } from "react";

interface AnimatedGroupProps<T> {
    items: T[];
    getKey: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    mode?: AnimatePresenceProps["mode"];
}

/**
 * Wraps a set of items in AnimatePresence with consistent fade/scale animations.
 * Each item gets a motion.div wrapper with entrance/exit animations.
 */
export const AnimatedGroup = <T,>({
    items,
    getKey,
    renderItem,
    mode = "popLayout",
}: AnimatedGroupProps<T>) => {
    return (
        <AnimatePresence mode={mode}>
            {items.map((item) => (
                <motion.div
                    key={getKey(item)}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                    {renderItem(item)}
                </motion.div>
            ))}
        </AnimatePresence>
    );
};
