import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANIMATION_EFFECTS } from "./effects";
import {
    playStrikeSound,
    preloadStrikeSound,
    preloadStrikeSounds,
    primeStrikeSound,
    resetStrikeAudioCache,
} from "./strikeAudio";

/**
 * The cache is the whole feature: nine munitions share two files, and reusing one element per
 * path is what turns the first strike of a session from "fetch, decode, then play" into "play".
 * Reusing an element is only safe because a sound can never overlap itself, so the reset of
 * `currentTime` on every play is load-bearing too.
 */

class FakeAudio {
    static created: FakeAudio[] = [];
    preload = "";
    currentTime = 42;
    loadCalls = 0;
    muted = false;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();

    constructor(public readonly src: string) {
        FakeAudio.created.push(this);
    }

    load() {
        this.loadCalls++;
    }
}

const ZAP = "/sounds/laser-zap.mp3";

beforeEach(() => {
    FakeAudio.created = [];
    resetStrikeAudioCache();
    vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
    vi.unstubAllGlobals();
    resetStrikeAudioCache();
});

describe("preloadStrikeSound", () => {
    it("creates one eagerly-loading element per sound", () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);

        expect(FakeAudio.created).toHaveLength(1);
        expect(FakeAudio.created[0].src).toBe(ZAP);
        expect(FakeAudio.created[0].preload).toBe("auto");
        expect(FakeAudio.created[0].loadCalls).toBe(1);
    });

    it("is idempotent, so callers can fire it on every open", () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);

        expect(FakeAudio.created).toHaveLength(1);
    });

    it("shares one element between munitions on the same file", () => {
        // RAILGUN and ORBITAL_LANCE are both beam-family, so they point at the same mp3.
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        preloadStrikeSound(ANIMATION_EFFECTS.RAILGUN);

        expect(FakeAudio.created).toHaveLength(1);
    });

    it("creates only as many elements as there are distinct sounds in the pool", () => {
        preloadStrikeSounds(Object.values(ANIMATION_EFFECTS));

        const distinct = new Set(
            Object.values(ANIMATION_EFFECTS)
                .map((effect) => effect.soundPath)
                .filter(Boolean)
        );
        expect(FakeAudio.created).toHaveLength(distinct.size);
    });
});

describe("playStrikeSound", () => {
    it("reuses the preloaded element rather than building a new one", async () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        await playStrikeSound(ZAP);

        expect(FakeAudio.created).toHaveLength(1);
        expect(FakeAudio.created[0].play).toHaveBeenCalledOnce();
    });

    it("rewinds before playing, so a second strike is not silent", async () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        await playStrikeSound(ZAP);

        expect(FakeAudio.created[0].currentTime).toBe(0);
    });

    it("still plays a sound that was never preloaded", async () => {
        await playStrikeSound(ZAP);

        expect(FakeAudio.created).toHaveLength(1);
        expect(FakeAudio.created[0].play).toHaveBeenCalledOnce();
    });

    // The hook catches this and falls back to haptics, so it must reject rather than resolve.
    it("rejects when playback fails", async () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        FakeAudio.created[0].play.mockRejectedValueOnce(new Error("autoplay blocked"));

        await expect(playStrikeSound(ZAP)).rejects.toThrow("autoplay blocked");
    });

    it("rejects where Audio does not exist at all", async () => {
        vi.stubGlobal("Audio", undefined);

        await expect(playStrikeSound(ZAP)).rejects.toThrow();
    });
});

/**
 * The bang is scheduled for `impactAtMs`, so the `play()` that the user hears runs from a
 * timeout rather than from the tap. A WebView refuses the *first* play of an element outside a
 * gesture, so priming - a muted play/pause spent during the tap - is what keeps the delayed
 * shot audible.
 */
describe("primeStrikeSound", () => {
    it("unlocks the element silently", async () => {
        primeStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        const audio = FakeAudio.created[0];

        // Muted *before* play, or the unlock is a spoiler for the strike.
        expect(audio.muted).toBe(true);
        expect(audio.play).toHaveBeenCalledOnce();

        await vi.waitFor(() => expect(audio.pause).toHaveBeenCalledOnce());
        expect(audio.currentTime).toBe(0);
        expect(audio.muted).toBe(false);
    });

    it("only spends a gesture on an element once", async () => {
        primeStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        const audio = FakeAudio.created[0];
        await vi.waitFor(() => expect(audio.pause).toHaveBeenCalledOnce());

        primeStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        primeStrikeSound(ANIMATION_EFFECTS.RAILGUN);

        expect(audio.play).toHaveBeenCalledOnce();
    });

    it("leaves the element audible when the WebView refuses the unlock", async () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        const audio = FakeAudio.created[0];
        audio.play.mockRejectedValueOnce(new Error("blocked"));

        primeStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);

        await vi.waitFor(() => expect(audio.muted).toBe(false));
        expect(audio.pause).not.toHaveBeenCalled();
    });

    it("does not pause a strike that fired while it was still warming up", async () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        const audio = FakeAudio.created[0];
        let unblock: () => void = () => {};
        audio.play.mockReturnValueOnce(
            new Promise<void>((resolve) => {
                unblock = () => resolve();
            })
        );

        primeStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        await playStrikeSound(ZAP);
        unblock();
        await Promise.resolve();

        expect(audio.pause).not.toHaveBeenCalled();
        expect(audio.muted).toBe(false);
    });
});

describe("playStrikeSound unmuting", () => {
    it("unmutes an element a prime left muted", async () => {
        preloadStrikeSound(ANIMATION_EFFECTS.ORBITAL_LANCE);
        const audio = FakeAudio.created[0];
        audio.muted = true;

        await playStrikeSound(ZAP);

        expect(audio.muted).toBe(false);
    });
});
