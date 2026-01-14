import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useState, useCallback, useRef, useEffect } from "react";
import type { AnimationEffect } from "../animations/effects";

/**
 * Hook for triggering overlay animations with sound and haptics
 * Prevents simultaneous animations using a module-level flag
 */

// Module-level flag to prevent simultaneous animations
let isAnyAnimationActive = false;

interface UseOverlayAnimationResult {
    /** Trigger the animation */
    trigger: () => Promise<void>;
    /** Whether this animation is currently active */
    isActive: boolean;
    /** The CSS class to apply (empty string when not active) */
    cssClass: string;
}

export const useOverlayAnimation = (
    effect: AnimationEffect
): UseOverlayAnimationResult => {
    const [isActive, setIsActive] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            // Don't pause audio - it will complete naturally
            // Calling pause() can interrupt play() and cause AbortError
            audioRef.current = null;
            if (isActive) {
                isAnyAnimationActive = false;
            }
        };
    }, [isActive]);

    const trigger = useCallback(async () => {
        // Prevent simultaneous animations
        if (isAnyAnimationActive) {
            console.warn("Animation already in progress, ignoring trigger");
            return;
        }

        isAnyAnimationActive = true;
        setIsActive(true);

        // Play sound effect if provided
        if (effect.soundPath) {
            try {
                audioRef.current = new Audio(effect.soundPath);
                await audioRef.current.play();
            } catch (error) {
                console.warn("Failed to play sound effect:", error);
                // Fallback to haptics if sound fails
                if (effect.haptic) {
                    try {
                        await Haptics.impact({ style: ImpactStyle.Heavy });
                    } catch (hapticError) {
                        console.warn("Haptics also failed:", hapticError);
                    }
                }
            }
        }

        // Trigger haptic feedback
        if (effect.haptic) {
            try {
                await Haptics.impact({ style: ImpactStyle.Heavy });
            } catch (error) {
                console.warn("Failed to trigger haptics:", error);
            }
        }

        // Auto-cleanup after animation duration
        timeoutRef.current = setTimeout(() => {
            setIsActive(false);
            isAnyAnimationActive = false;
            timeoutRef.current = null;
        }, effect.duration);
    }, [effect]);

    return {
        trigger,
        isActive,
        cssClass: isActive ? effect.cssClass : "",
    };
};
