/**
 * Shared library of overlay animation effects
 * Each effect defines its CSS class, sound file, duration, and haptic feedback
 */

export interface AnimationEffect {
    /** CSS class name to apply to overlay */
    cssClass: string;
    /** Path to sound file in public/ folder (optional) */
    soundPath?: string;
    /** Duration of animation in milliseconds */
    duration: number;
    /** Whether to trigger haptic feedback */
    haptic?: boolean;
}

/**
 * Library of available animation effects
 */
export const ANIMATION_EFFECTS = {
    /**
     * Laser obliteration effect - purple laser sweeps from top to bottom
     * Used when clearing checked shopping list items
     */
    LASER_OBLITERATION: {
        cssClass: "laser-obliteration",
        soundPath: "/sounds/laser-zap.mp3",
        duration: 1000, // 1 second
        haptic: true,
    } as AnimationEffect,

    // Future animations can be added here
    // EXPLOSION: { cssClass: 'explosion', duration: 800, ... },
    // SWIPE_AWAY: { cssClass: 'swipe-away', duration: 600, ... },
} as const;

export type AnimationEffectName = keyof typeof ANIMATION_EFFECTS;
