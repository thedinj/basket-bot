import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useState, useCallback, useRef, useEffect } from "react";
import type { AnimationEffect } from "../animations/effects";
import { playStrikeSound, preloadStrikeSound } from "../animations/strikeAudio";

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

export const useOverlayAnimation = (effect: AnimationEffect): UseOverlayAnimationResult => {
    const [active, setActive] = useState<AnimationEffect | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Warm the default effect's audio so the bang lands on the flash rather than after it.
    // Callers that pick at the last moment should also preload at their own gesture.
    useEffect(() => {
        preloadStrikeSound(effect);
    }, [effect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (active) {
                isAnyAnimationActive = false;
            }
        };
    }, [active]);

    const trigger = useCallback(
        async (override?: AnimationEffect) => {
            const firing = override ?? effect;

            // Prevent simultaneous animations
            if (isAnyAnimationActive) {
                console.warn("Animation already in progress, ignoring trigger");
                return;
            }

            isAnyAnimationActive = true;
            setActive(firing);

            // Play sound effect if provided
            if (firing.soundPath) {
                try {
                    await playStrikeSound(firing.soundPath);
                } catch (error) {
                    console.warn("Failed to play sound effect:", error);
                    // Fallback to haptics if sound fails
                    if (firing.haptic) {
                        try {
                            await Haptics.impact({ style: ImpactStyle.Heavy });
                        } catch (hapticError) {
                            console.warn("Haptics also failed:", hapticError);
                        }
                    }
                }
            }

            // Trigger haptic feedback
            if (firing.haptic) {
                try {
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                } catch (error) {
                    console.warn("Failed to trigger haptics:", error);
                }
            }

            // Auto-cleanup after the *fired* effect's duration, not the default's.
            timeoutRef.current = setTimeout(() => {
                setActive(null);
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
