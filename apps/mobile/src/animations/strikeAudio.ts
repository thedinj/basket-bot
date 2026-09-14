import type { AnimationEffect } from "./effects";

/**
 * Preloaded audio for overlay animations.
 *
 * The hook used to `new Audio(path)` and immediately `play()` it, so the first strike of a
 * session paid fetch + decode latency and the bang landed *after* the flash. Nine munitions share
 * two files, so one path-keyed cache fixes every one of them at once.
 *
 * Elements are reused across strikes rather than recreated. That is safe because
 * `useOverlayAnimation`'s module-level guard means a sound can never need to overlap itself.
 */

const cache = new Map<string, HTMLAudioElement>();

function element(path: string): HTMLAudioElement | null {
    const existing = cache.get(path);
    if (existing) return existing;

    // Guards SSR and the `node` test environment, where Audio does not exist.
    if (typeof Audio === "undefined") return null;

    const audio = new Audio(path);
    audio.preload = "auto";
    audio.load();
    cache.set(path, audio);
    return audio;
}

/**
 * Fetch and decode a munition's sound ahead of use. Idempotent, so callers can fire it on every
 * open without checking.
 *
 * Call this from a user gesture wherever possible - opening the confirm sheet, presenting the
 * alert. Mobile WebViews defer audio work until the first gesture, and those moments buy seconds
 * of lead time before the strike is actually authorised.
 */
export function preloadStrikeSound(effect: AnimationEffect): void {
    if (effect.soundPath) {
        element(effect.soundPath);
    }
}

/** Preload every distinct sound in a set of munitions. */
export function preloadStrikeSounds(effects: readonly AnimationEffect[]): void {
    effects.forEach(preloadStrikeSound);
}

/**
 * Play a preloaded sound from the top, loading it first if it was never preloaded. Rejects the
 * way `Audio.play()` does, so the caller's existing catch -> haptic fallback keeps working.
 */
export async function playStrikeSound(path: string): Promise<void> {
    const audio = element(path);
    if (!audio) throw new Error("Audio is unavailable in this environment");

    audio.currentTime = 0;
    await audio.play();
}

/** Test seam - drops every cached element. */
export function resetStrikeAudioCache(): void {
    cache.clear();
}
