import { describe, expect, it } from "vitest";
import { ANIMATION_EFFECTS, pickStrike, STRIKE_POOL } from "./effects";

/**
 * The animation system has no way to assert motion, but it does have bug classes worth pinning.
 * `duration` is what `useOverlayAnimation` uses to self-reset and release its module-level "one
 * animation at a time" flag, while the real timeline lives in the per-effect CSS; `impactAtMs` is
 * when a consumer commits its destructive work under cover of the effect. Those numbers are
 * duplicated by hand and drift is silent.
 */
describe("animation effects registry", () => {
    const entries = Object.entries(ANIMATION_EFFECTS);

    it.each(entries)("%s declares a usable duration", (_name, effect) => {
        expect(effect.duration).toBeGreaterThan(0);
    });

    it.each(entries)("%s declares a non-empty cssClass", (_name, effect) => {
        expect(effect.cssClass.trim()).not.toBe("");
    });

    it.each(entries)("%s declares a non-empty label", (_name, effect) => {
        expect(effect.label.trim()).not.toBe("");
    });

    it.each(entries)("%s points any sound at the public sounds folder", (_name, effect) => {
        if (effect.soundPath !== undefined) {
            expect(effect.soundPath).toMatch(/^\/sounds\/[\w.-]+$/);
        }
    });

    /**
     * The invariant that keeps a consumer from committing its delete after the cover animation
     * has already cleared - which would show the user the rows vanishing in plain view.
     */
    it.each(entries)("%s lands within its own runtime", (_name, effect) => {
        expect(effect.impactAtMs).toBeGreaterThan(0);
        expect(effect.impactAtMs).toBeLessThanOrEqual(effect.duration);
    });

    // Two effects sharing a class would style each other, and the module-level guard means
    // only one can ever be on screen anyway - so a collision is always a mistake.
    it("gives every effect a distinct cssClass", () => {
        const classes = entries.map(([, effect]) => effect.cssClass);
        expect(new Set(classes).size).toBe(classes.length);
    });

    it("gives every effect a distinct label", () => {
        const labels = entries.map(([, effect]) => effect.label);
        expect(new Set(labels).size).toBe(labels.length);
    });
});

describe("strike pool", () => {
    it("carries every registered effect", () => {
        // Catches an effect added to the registry but left unreachable by a roll.
        expect([...STRIKE_POOL].sort()).toEqual(Object.values(ANIMATION_EFFECTS).sort());
    });

    it("holds at least five munitions", () => {
        expect(STRIKE_POOL.length).toBeGreaterThanOrEqual(5);
    });
});

describe("pickStrike", () => {
    it("always returns a pool member", () => {
        const sequence = [0, 0.25, 0.5, 0.75, 0.999];
        let i = 0;
        for (let roll = 0; roll < 40; roll++) {
            const picked = pickStrike(() => sequence[i++ % sequence.length]);
            expect(STRIKE_POOL).toContain(picked);
        }
    });

    /**
     * The whole point of the feature. Two identical strikes back to back read as a bug rather
     * than as chance, so the picker excludes its own last answer - including when the injected
     * random keeps asking for the same index.
     */
    it("never returns the same munition twice running", () => {
        const rolled = Array.from({ length: 60 }, () => pickStrike(() => 0));
        rolled.forEach((effect, i) => {
            if (i > 0) expect(effect).not.toBe(rolled[i - 1]);
        });
    });

    it("can reach every munition in the pool", () => {
        const seen = new Set<string>();
        // Sweep the whole [0,1) range repeatedly; the shrinking candidate list shifts which
        // effect each fraction maps to, so every one comes up.
        for (let roll = 0; roll < 400; roll++) {
            seen.add(pickStrike(() => (roll % 97) / 97).cssClass);
        }
        expect(seen.size).toBe(STRIKE_POOL.length);
    });
});
