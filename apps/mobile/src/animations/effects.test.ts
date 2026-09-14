import { describe, expect, it } from "vitest";
import { ANIMATION_EFFECTS } from "./effects";

/**
 * The animation system has no way to assert motion, but it does have one bug class worth
 * pinning: the registry's `duration` is what `useOverlayAnimation` uses to self-reset and
 * release its module-level "one animation at a time" flag, while the real timeline lives in
 * OverlayAnimation.css and any consumer-side timers live in the component. Those numbers are
 * duplicated by hand, and drift is silent - the laser already declares 1650ms for a timeline
 * that ends at 1600ms.
 */
describe("animation effects registry", () => {
    const entries = Object.entries(ANIMATION_EFFECTS);

    it.each(entries)("%s declares a usable duration", (_name, effect) => {
        expect(effect.duration).toBeGreaterThan(0);
    });

    it.each(entries)("%s declares a non-empty cssClass", (_name, effect) => {
        expect(effect.cssClass.trim()).not.toBe("");
    });

    it.each(entries)("%s points any sound at the public sounds folder", (_name, effect) => {
        if (effect.soundPath !== undefined) {
            expect(effect.soundPath).toMatch(/^\/sounds\/[\w.-]+$/);
        }
    });

    // Two effects sharing a class would style each other, and the module-level guard means
    // only one can ever be on screen anyway - so a collision is always a mistake.
    it("gives every effect a distinct cssClass", () => {
        const classes = entries.map(([, effect]) => effect.cssClass);
        expect(new Set(classes).size).toBe(classes.length);
    });
});
