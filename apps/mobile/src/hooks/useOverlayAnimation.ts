import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useState, useCallback, useRef, useEffect } from "react";
import type { AnimationEffect } from "../animations/effects";
import { playStrikeSound, preloadStrikeSound, primeStrikeSound } from "../animations/strikeAudio";

/**
 * Hook for triggering overlay animations with sound and haptics
 * Prevents simultaneous animations using a module-level flag
 */

// Module-level flag to prevent simultaneous animations
let isAnyAnimationActive = false;

interface UseOverlayAnimationResult {
    /**
     * Trigger the animation. Pass an effect to fire that one instead of the hook's default -
     * necessary when a caller picks a munition and fires it in the same handler, since this
     * callback closes over the effect it was rendered with.
     */
    trigger: (override?: AnimationEffect) => Promise<void>;
    /** Whether this animation is currently active */
    isActive: boolean;
    /** The CSS class to apply (empty string when not active) */
    cssClass: string;
    /** The effect currently playing, or null. */
    activeEffect: AnimationEffect | null;
}

/**
 * Everything that happens when the munition connects. Sound first, then haptics regardless of
 * whether it played - a silent WebView still owes the user a thump.
 */
const land = async (firing: AnimationEffect): Promise<void> => {
    if (firing.soundPath) {
        try {
            await playStrikeSound(firing.soundPath);
        } catch (error) {
            console.warn("Failed to play sound effect:", error);
        }
    }

    if (firing.haptic) {
        try {
            await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (error) {
            console.warn("Failed to trigger haptics:", error);
        }
    }
};

export const useOverlayAnimation = (effect: AnimationEffect): UseOverlayAnimationResult => {
    const [active, setActive] = useState<AnimationEffect | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const impactRef = useRef<NodeJS.Timeout | null>(null);
    // Mirrors `active` for the unmount cleanup. A ref, not the state, because reading the state
    // there would mean depending on it - and that is what turned this into a teardown that ran
    // on every strike instead of on unmount.
    const firingRef = useRef(false);

    // Warm the default effect's audio so the bang lands on `impactAtMs` rather than after it.
    // Callers that pick at the last moment should also preload at their own gesture.
    useEffect(() => {
        preloadStrikeSound(effect);
    }, [effect]);

    // Cleanup on unmount - and *only* on unmount. This used to depend on [active], which meant
    // its teardown ran on the very `setActive(firing)` that starts a strike: React re-rendered,
    // the dependency went null -> effect, and the cleanup killed the impact and duration timers
    // that `trigger` had just set. The symptoms were a silent strike (impact timer gone), an
    // overlay that never cleared and so replayed on the next open (duration timer gone), and a
    // permanently stuck `isAnyAnimationActive` that refused every later strike. It survived
    // review because `trigger` used to await the sound before setting its timers, so the
    // re-render landed ahead of them; making the sound wait for impact removed that accident.
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (impactRef.current) {
                clearTimeout(impactRef.current);
            }
            if (firingRef.current) {
                firingRef.current = false;
                isAnyAnimationActive = false;
            }
        };
    }, []);

    const trigger = useCallback(
        async (override?: AnimationEffect) => {
            const firing = override ?? effect;

            // Prevent simultaneous animations
            if (isAnyAnimationActive) {
                console.warn("Animation already in progress, ignoring trigger");
                return;
            }

            isAnyAnimationActive = true;
            firingRef.current = true;
            setActive(firing);

            // Spend the caller's gesture unlocking the element, because the play() that is
            // actually heard happens on a timer below and a WebView would refuse it cold.
            primeStrikeSound(firing);

            // Sound and haptics are the *impact*, so they wait for it. Firing them here would
            // put the bang on the muzzle flash - a 1.8s solar lens would detonate at t=0 and
            // then spend most of two seconds visibly catching up with its own explosion.
            impactRef.current = setTimeout(() => {
                impactRef.current = null;
                void land(firing);
            }, firing.impactAtMs);

            // Auto-cleanup after the *fired* effect's duration, not the default's.
            timeoutRef.current = setTimeout(() => {
                setActive(null);
                firingRef.current = false;
                isAnyAnimationActive = false;
                timeoutRef.current = null;
            }, firing.duration);
        },
        [effect]
    );

    return {
        trigger,
        isActive: active !== null,
        cssClass: active?.cssClass ?? "",
        activeEffect: active,
    };
};
