/**
 * Whether the user is currently working the screen — a finger down, or a moment either side
 * of one.
 *
 Two readers:
 *
 * - `startStoreSync` waits for the hand to leave before applying someone else's changes. A
 *   refetch that lands between aiming at a row and touching it moves that row away, and the tap
 *   goes to whatever slid into its place. Waiting costs nothing — nobody reads a list at the
 *   instant they tap it — and the wait is capped (`MAX_INTERACTION_HOLD_MS`) so a continuously
 *   busy screen still takes updates.
 * - `AnimatedGroup` reads it the other way round: a row that moves or appears *while* the gate
 *   is active was almost certainly set off by the user's own tap, so it is not shielded.
 *   Shielding those would make checking several items in a row feel like wading.
 *
 * Plain module state with an injectable clock, so the policy is testable in the node env;
 * `useInteractionGate` is the only thing that touches the DOM.
 */

/** How long after the last touch or scroll the screen still counts as in use. */
export const INTERACTION_QUIET_MS = 600;

/** The longest an update may be held back, however busy the screen is. */
export const MAX_INTERACTION_HOLD_MS = 5_000;

class InteractionGate {
    /** Pointers currently down. Counted, not a flag: a second finger must not clear the first. */
    private pointersDown = 0;
    private lastActivityAt = 0;

    pointerDown(now: number = Date.now()): void {
        this.pointersDown += 1;
        this.lastActivityAt = now;
    }

    pointerUp(now: number = Date.now()): void {
        this.pointersDown = Math.max(0, this.pointersDown - 1);
        this.lastActivityAt = now;
    }

    /** Any other sign of use — a scroll, a drag. */
    note(now: number = Date.now()): void {
        this.lastActivityAt = now;
    }

    isActive(now: number = Date.now()): boolean {
        return this.pointersDown > 0 || now - this.lastActivityAt < INTERACTION_QUIET_MS;
    }

    /**
     * Test seam, and a way back to a known state if a `pointerup` is ever lost (a pointer
     * captured by a native overlay, say) — without it the count could stick above zero and
     * hold updates for the whole visit.
     */
    reset(): void {
        this.pointersDown = 0;
        this.lastActivityAt = 0;
    }
}

export const interactionGate = new InteractionGate();
