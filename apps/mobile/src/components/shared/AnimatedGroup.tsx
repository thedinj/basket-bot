import clsx from "clsx";
import { interactionGate } from "../../utils/interactionGate";
import { AnimatePresence, AnimatePresenceProps, motion, useReducedMotion } from "motion/react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

import "./AnimatedGroup.scss";

// Natural deceleration — confident, no overshoot
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

const LAYOUT_DURATION_S = 0.2;

/**
 * How long a row that has just moved or appeared keeps refusing taps — so about 700 ms from
 * the moment it starts, counting the animation itself.
 *
 * A list that rearranges itself sends taps to the wrong item: you aim at a row, something
 * another shopper did shifts it away, and your finger lands on whatever took its place. Rather
 * than stop the list moving, the rows involved simply stop accepting taps while they are in
 * motion and for a beat after. The tap does nothing and is repeated — far better than doing
 * the wrong thing to the wrong item. They are skipped for hit-testing rather than disabled, so
 * a touch that lands on one still scrolls the list, and they dim while they are out
 * (`.settling-row`): a tap that does nothing and *looks* like nothing reads as a broken app.
 *
 * Two things arm it: a row moving (a layout animation) and a row arriving (a key that wasn't
 * in the list before). An arrival matters as much as a move — an item someone else adds lands
 * in aisle order, which can be directly under a thumb.
 */
const TAP_GUARD_MS = 500;

interface AnimatedGroupProps<T> {
    items: T[];
    getKey: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    mode?: AnimatePresenceProps["mode"];
    /** Class for each item's wrapper, e.g. to make the wrapper itself sticky. */
    itemClassName?: string;
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
    itemClassName,
}: AnimatedGroupProps<T>) => {
    const reducedMotion = useReducedMotion();

    // Keys whose row is moving, or has just stopped. Held here rather than inside a wrapper
    // component per row, because `AnimatePresence` (in `popLayout` especially) has to see the
    // `motion.div`s themselves as its children: wrapping one in a component of its own left
    // exiting rows in the DOM for good, a ghost copy of every item checked off.
    const [settlingKeys, setSettlingKeys] = useState<ReadonlySet<string>>(() => new Set());
    const guardTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const armTapGuard = useCallback((key: string) => {
        // A row that moves while the user is touching the screen is almost always moving
        // *because* of them — their own check-off, their own edit — and they are not
        // surprised by it. (Remote changes wait for the hand to leave: see `startStoreSync`.)
        // Shielding those would make checking several items in a row feel like wading. The one
        // gap is a remote change forced through by the sync layer's 5 s cap.
        if (interactionGate.isActive()) {
            return;
        }

        setSettlingKeys((previous) => {
            if (previous.has(key)) {
                return previous;
            }
            const next = new Set(previous);
            next.add(key);
            return next;
        });

        const running = guardTimers.current.get(key);
        if (running) {
            clearTimeout(running);
        }
        // Timed rather than released by the animation's own completion callback: a layout
        // animation that is interrupted by the next one, or never finishes, would otherwise
        // leave the row refusing taps for good.
        guardTimers.current.set(
            key,
            setTimeout(
                () => {
                    guardTimers.current.delete(key);
                    setSettlingKeys((previous) => {
                        if (!previous.has(key)) {
                            return previous;
                        }
                        const next = new Set(previous);
                        next.delete(key);
                        return next;
                    });
                },
                LAYOUT_DURATION_S * 1000 + TAP_GUARD_MS
            )
        );
    }, []);

    useEffect(() => {
        const timers = guardTimers.current;
        return () => {
            timers.forEach((timer) => clearTimeout(timer));
            timers.clear();
        };
    }, []);

    // Rows that have arrived since the last render. `null` until the first render has been
    // recorded, so a list appearing for the first time shields nothing — everything is new
    // then, and dimming the lot would make the screen look broken on arrival.
    const knownKeysRef = useRef<Set<string> | null>(null);
    useEffect(() => {
        const keys = items.map(getKey);
        const known = knownKeysRef.current;
        knownKeysRef.current = new Set(keys);

        if (known === null) {
            return;
        }
        keys.filter((key) => !known.has(key)).forEach(armTapGuard);
    }, [items, getKey, armTapGuard]);

    return (
        <AnimatePresence mode={mode}>
            {items.map((item) => {
                const key = getKey(item);
                return (
                    <motion.div
                        key={key}
                        className={clsx(itemClassName, settlingKeys.has(key) && "settling-row")}
                        // Kept on under reduced motion, where it is effectively instant: it is
                        // what tells a row it has moved, and a row that jumps without warning
                        // is the one most in need of the tap guard.
                        layout
                        onLayoutAnimationStart={() => armTapGuard(key)}
                        style={settlingKeys.has(key) ? { pointerEvents: "none" } : undefined}
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
                                ? { duration: 0.15, layout: { duration: 0 } }
                                : {
                                      opacity: { duration: 0.22, ease: EASE_OUT_QUART },
                                      y: { duration: 0.22, ease: EASE_OUT_QUART },
                                      layout: { duration: LAYOUT_DURATION_S, ease: EASE_OUT_QUART },
                                  }
                        }
                    >
                        {renderItem(item)}
                    </motion.div>
                );
            })}
        </AnimatePresence>
    );
};
