/**
 * Shared library of overlay animation effects.
 *
 * Every effect is a munition the orbital platform can load: both "Obliterate" actions roll one
 * from STRIKE_POOL rather than always firing the same thing. Effects are deliberately kept off
 * each other's axes (geometry, palette, motion primitive, signature CSS property) so the pool
 * reads as a menu of weapons rather than one effect recolored - see animations/README.md for
 * the distinctness table.
 */

export interface AnimationEffect {
    /** CSS class name to apply to overlay */
    cssClass: string;
    /** Path to sound file in public/ folder (optional) */
    soundPath?: string;
    /**
     * Total wall time in milliseconds. `useOverlayAnimation` uses it to self-reset and release
     * its module-level "one animation at a time" guard, so it must match the longest keyframe.
     */
    duration: number;
    /** Whether to trigger haptic feedback */
    haptic?: boolean;
    /**
     * Munition name for the UI, e.g. "KINETIC ROD". Shown in the store-items manifest and the
     * shopping-list confirm alert, so the platform names what it loaded before it fires.
     */
    label: string;
    /**
     * When the strike lands - the moment a consumer may commit its destructive work under cover
     * of the effect. Was a hardcoded 1000 in ShoppingList.tsx; per-munition now, because a 0.9s
     * null pulse and a 1.8s solar lens do not land at the same instant.
     */
    impactAtMs: number;
}

/** Beam-family munitions. */
const ZAP = "/sounds/laser-zap.mp3";
/** Impact-family munitions. */
const BOOM = "/sounds/explosion.mp3";

/**
 * Library of available animation effects.
 */
export const ANIMATION_EFFECTS = {
    /**
     * Vertical purple beam with a white core sweeps top to bottom, then a thinner beam scans
     * back up as confirmation. The original effect, reframed as one munition among many.
     */
    ORBITAL_LANCE: {
        cssClass: "orbital-lance",
        soundPath: ZAP,
        duration: 1600, // forward beam (1s) + return scan beam (0.7s, starts at 0.9s)
        haptic: true,
        label: "ORBITAL LANCE",
        impactAtMs: 1000,
    },

    /**
     * White-out flash, fireball bloom, expanding shockwave, amber fallout. Radial and red/amber
     * where the lance is a vertical purple sweep.
     */
    TACTICAL_AIRBURST: {
        cssClass: "tactical-airburst",
        soundPath: BOOM,
        duration: 1200, // flash 0-90ms, fireball 40-590ms, shockwave 120-900ms, fallout to 1200ms
        haptic: true,
        label: "TACTICAL AIRBURST",
        impactAtMs: 250,
    },

    /**
     * A tungsten rod arrives diagonally from the upper right at terminal velocity, then throws a
     * bottom-anchored dust bloom. Owns diagonal translation and blue-white heat.
     */
    KINETIC_ROD: {
        cssClass: "kinetic-rod",
        soundPath: BOOM,
        duration: 1400, // streak 0-620ms, impact bloom 560-1400ms
        haptic: true,
        label: "KINETIC ROD",
        impactAtMs: 700,
    },

    /**
     * Four reticle brackets converge on the target and snap shut, then a flat concussive ring
     * punches outward. Owns hard-edged line art - the only effect with no blur anywhere.
     */
    RAILGUN: {
        cssClass: "railgun",
        soundPath: ZAP,
        duration: 1650, // brackets converge 0-700ms, hold 700-850ms, ring 850-1650ms
        haptic: true,
        label: "RAILGUN",
        impactAtMs: 900,
    },

    /**
     * Six warheads walk across the viewport on staggered delays, then a combined whiteout.
     * Owns multi-point staggering; needs the overlay's extra layers.
     */
    MIRV_SALVO: {
        cssClass: "mirv-salvo",
        soundPath: BOOM,
        duration: 1500, // six impacts 120-1040ms, combined flash 1000-1500ms
        haptic: true,
        label: "MIRV SALVO",
        impactAtMs: 1100,
    },

    /**
     * The app desaturates to steel, a hexagonal wireframe expands and collapses, colour snaps
     * back. The short cold one - no fire at all, and the pool's rhythm break.
     */
    NULL_PULSE: {
        cssClass: "null-pulse",
        soundPath: ZAP,
        duration: 900, // drain 0-180ms, hex 100-620ms, restore 620-900ms
        haptic: true,
        label: "NULL PULSE",
        impactAtMs: 400,
    },

    /**
     * An orbital mirror array walks its rays inward and holds focus until the point ignites,
     * leaving a retinal afterimage. The only munition that builds instead of striking, and the
     * only one that rotates.
     */
    SOLAR_LENS: {
        cssClass: "solar-lens",
        soundPath: ZAP,
        duration: 1800, // rays converge 0-1150ms, ignition 1150-1400ms, afterimage to 1800ms
        haptic: true,
        label: "SOLAR LENS",
        impactAtMs: 1250,
    },

    /**
     * A singularity opens: the viewport is drawn inward past a rotating accretion ring while the
     * app behind it smears, then the horizon collapses and rebounds. The only effect that
     * contracts rather than expands.
     */
    EVENT_HORIZON: {
        cssClass: "event-horizon",
        soundPath: BOOM,
        duration: 1500, // horizon forms 0-900ms, collapse 900-1180ms, rebound to 1500ms
        haptic: true,
        label: "EVENT HORIZON",
        impactAtMs: 1000,
    },

    /**
     * A blade snaps across the viewport at its widest line, pauses, then the cut opens into a
     * black gap with cauterised edges. Owns staccato timing - snap, hold, separate.
     *
     * Named for the geometry: the cut is horizontal and centred, so the platform is bisecting
     * the planet along its equator to remove a handful of groceries.
     */
    EQUATORIAL_GUILLOTINE: {
        cssClass: "equatorial-guillotine",
        soundPath: ZAP,
        duration: 1100, // blade 0-180ms, hold 180-380ms, gap opens 380-1100ms
        haptic: true,
        label: "EQUATORIAL GUILLOTINE",
        impactAtMs: 650,
    },
} satisfies Record<string, AnimationEffect>;

export type AnimationEffectName = keyof typeof ANIMATION_EFFECTS;

/**
 * Every munition the platform can load. Derived from the registry rather than hand-listed, so an
 * effect can never be added above and silently left unreachable by a roll.
 */
export const STRIKE_POOL: AnimationEffect[] = Object.values(ANIMATION_EFFECTS);

/** The last munition handed out, so a roll never repeats back to back. */
let lastPicked: AnimationEffect | null = null;

/**
 * Roll a munition. Never returns the same one twice running - repetition is exactly what this
 * feature exists to avoid, and two identical strikes in a row read as a bug rather than chance.
 *
 * `random` is injectable so tests can be deterministic instead of statistical.
 */
export function pickStrike(random: () => number = Math.random): AnimationEffect {
    const candidates = STRIKE_POOL.filter((effect) => effect !== lastPicked);
    const choice = candidates[Math.floor(random() * candidates.length)] ?? STRIKE_POOL[0];
    lastPicked = choice;
    return choice;
}
