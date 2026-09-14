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
        duration: 1650, // forward beam (1s) + return scan beam (0.7s, starts at 0.9s)
        haptic: true,
    } as AnimationEffect,

    /**
     * Nuclear detonation - white-out flash, fireball bloom, expanding shockwave, amber fallout.
     * Used when obliterating unused store items. Deliberately radial and red/amber where the
     * laser is a vertical purple sweep, so the two read as different events rather than as the
     * same effect recolored.
     */
    NUCLEAR_DETONATION: {
        cssClass: "nuclear-detonation",
        soundPath: "/sounds/explosion.mp3",
        duration: 1200, // flash 0-90ms, fireball 40-590ms, shockwave 120-900ms, fallout to 1200ms
        haptic: true,
    } as AnimationEffect,

    // Future animations can be added here
    // SWIPE_AWAY: { cssClass: 'swipe-away', duration: 600, ... },
} as const;

export type AnimationEffectName = keyof typeof ANIMATION_EFFECTS;
