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

/**
 * Elements that have completed a real `play()` at least once. A mobile WebView gates the *first*
 * playback of an element on a user gesture; every later one is unrestricted, which is what makes
 * a sound scheduled on a timer safe.
 */
const unlocked = new WeakSet<HTMLAudioElement>();

/**
 * Bumped by every real strike so a still-pending prime cannot pause the shot it was warming up
 * for. Without it, a prime that resolves after impact silently kills the sound.
 */
let strikeGeneration = 0;

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
 * Unlock a munition's sound for later playback from a timer.
 *
 * Decoding is not the only gate: a WebView also refuses the first `play()` of an element that did
 * not originate in a user gesture. Since the bang now lands at `impactAtMs` rather than on the
 * flash, the `play()` that matters happens on a timeout - so we spend the gesture on a muted
 * play/pause, after which the element is permanently free to be replayed on any schedule.
 *
 * Silent by construction (muted before it starts, rewound after), idempotent, and never throws -
 * a WebView that refuses even this leaves `playStrikeSound` to try again and the caller's
 * haptic fallback to cover it.
 */
export function primeStrikeSound(effect: AnimationEffect): void {
    const audio = effect.soundPath ? element(effect.soundPath) : null;
    if (!audio || unlocked.has(audio)) return;

    const generation = strikeGeneration;
    audio.muted = true;
    audio.currentTime = 0;

    void Promise.resolve(audio.play())
        .then(() => {
            unlocked.add(audio);
            // The strike already fired while we were warming up - leave it playing.
            if (generation !== strikeGeneration) return;
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
        })
        .catch(() => {
            audio.muted = false;
        });
}

/**
 * Play a preloaded sound from the top, loading it first if it was never preloaded. Rejects the
 * way `Audio.play()` does, so the caller's existing catch -> haptic fallback keeps working.
 */
export async function playStrikeSound(path: string): Promise<void> {
    const audio = element(path);
    if (!audio) throw new Error("Audio is unavailable in this environment");

    strikeGeneration++;
    // A prime left the element muted if it is still in flight; this is the shot that is heard.
    audio.muted = false;
    audio.currentTime = 0;
    await audio.play();
    unlocked.add(audio);
}

/** Test seam - drops every cached element. */
export function resetStrikeAudioCache(): void {
    cache.clear();
}
