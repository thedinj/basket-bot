# Overlay Animation System

## Overview

A reusable, CSS-first overlay animation system for full-screen effects in Basket Bot.

Every effect is a **munition** the orbital weapons platform can load. Both "Obliterate" actions —
the shopping list's _Obliterate Checked_ and the store items' _Obliterate Unused_ — roll one from
a shared pool rather than always firing the same thing, and name the munition in the UI before
firing it.

## Architecture

| Role                               | Path                                           |
| ---------------------------------- | ---------------------------------------------- |
| Effect registry + pool + picker    | `src/animations/effects.ts`                    |
| Preloaded audio                    | `src/animations/strikeAudio.ts`                |
| Hook (sound + haptics + lifecycle) | `src/hooks/useOverlayAnimation.ts`             |
| Overlay element                    | `src/components/shared/OverlayAnimation.tsx`   |
| Keyframes, one file per effect     | `src/components/shared/overlay/`               |
| Developer test bed                 | `src/components/settings/StrikeRangeModal.tsx` |

### The overlay element

`OverlayAnimation` renders a fixed, full-viewport, `pointer-events: none` div at `z-index: 10000`,
plus **three inert child layers**. The root and its `::before`/`::after` give three paintable
surfaces; the layers and their pseudo-elements add nine more, addressed with `:nth-child()`. The
MIRV salvo needs six impact points and the railgun needs four brackets — an effect that ignores
the layers pays nothing for them.

**Where to render it.** If the effect plays over a modal, render `<OverlayAnimation>` _inside_
that modal. Ionic stacks modals, so an overlay rendered by a parent paints **behind** an open
child sheet.

## Available Effects

Distinctness is the point. A pool where three effects read as "orange flash" is worse than two
good effects, so each munition owns a signature property no other one uses. **Keep a new effect
off every axis already claimed here.**

| Munition          | `label`               | Geometry                         | Palette            | Motion               | Signature property            |   ms | impact |
| ----------------- | --------------------- | -------------------------------- | ------------------ | -------------------- | ----------------------------- | ---: | -----: |
| Orbital lance     | ORBITAL LANCE         | vertical band                    | purple/white       | `translateY`         | `box-shadow` bloom            | 1600 |   1000 |
| Tactical airburst | TACTICAL AIRBURST     | radial                           | red/amber          | `scale` out          | `backdrop-filter: brightness` | 1200 |    250 |
| Kinetic rod       | KINETIC ROD           | diagonal streak, bottom bloom    | blue-white         | diagonal `translate` | bottom-anchored impact        | 1400 |    700 |
| Railgun           | RAILGUN               | four reticle brackets            | amber              | converge, snap, ring | hard edges, zero blur         | 1650 |    900 |
| MIRV salvo        | MIRV SALVO            | six points                       | orange/white       | staggered `scale`    | multi-layer stagger           | 1500 |   1100 |
| Null pulse        | NULL PULSE            | hexagon wireframe                | steel/gray         | expand then collapse | `backdrop-filter: grayscale`  |  900 |    400 |
| Solar lens        | SOLAR LENS            | converging conic rays            | yellow-white       | `rotate` + tighten   | `conic-gradient` + rotation   | 1800 |   1250 |
| Event horizon     | EVENT HORIZON         | inward vignette + accretion disc | black/violet-white | `scale` **in**       | `backdrop-filter: blur` ramp  | 1500 |   1000 |
| Eq. guillotine    | EQUATORIAL GUILLOTINE | razor line, widening gap         | white-hot on black | `scaleY` of a gap    | staccato snap-hold-open       | 1100 |    650 |
| Laser lattice     | LASER LATTICE         | orthogonal beam mesh             | laser red/white    | `translateZ` + turn  | `perspective` depth           | 1700 |   1200 |

Durations deliberately span 0.9s–1.8s so the _rhythm_ varies, not just the picture.

Two implementation notes worth knowing before editing them:

- **Null pulse's hex ring** is a single `clip-path` "keyhole" polygon — the outer hexagon
  traversed clockwise, a seam, then the inner hexagon counter-clockwise. Under the default
  nonzero fill rule that leaves the middle empty, which is the only way to get a true wireframe
  out of one element.
- **The equatorial guillotine's cut is implied.** The overlay paints _above_ the app, so it cannot actually
  shear content apart; the effect sells it with a razor line, a beat of nothing, and a black gap
  with cauterised edges.

## The descriptor

```typescript
export interface AnimationEffect {
    cssClass: string;
    soundPath?: string;
    /** Total wall time; must match the longest keyframe. */
    duration: number;
    haptic?: boolean;
    /** Munition name shown in the UI, e.g. "KINETIC ROD". */
    label: string;
    /** When the strike lands - when a consumer may commit its destructive work. */
    impactAtMs: number;
}
```

`duration` is what the hook uses to self-reset and release its one-at-a-time guard, so it must
equal the longest keyframe end. `impactAtMs` is what a consumer waits before committing a delete
under cover of the effect — it was a hardcoded `1000` in `ShoppingList.tsx` until the pool made
"when does it land" a per-munition question. The invariant `0 < impactAtMs <= duration` is
enforced by `effects.test.ts`.

## Rolling a munition

```typescript
import { pickStrike } from "@/animations/effects";

const munition = pickStrike(); // never the same one twice running
```

`STRIKE_POOL` is derived from `ANIMATION_EFFECTS` rather than hand-listed, so an effect can never
be registered and then silently left unreachable by a roll. `pickStrike` takes an injectable
`random` so tests are deterministic instead of statistical.

**Roll early, not at the last moment.** Both consumers pick when the confirm UI _opens_, which
lets the UI name the munition before you commit to it and gives its sound the whole
read-the-list pause to load.

## Sound

`strikeAudio.ts` keeps one `HTMLAudioElement` per path, created with `preload = "auto"`. Reusing
elements is safe because the module-level guard means a sound can never overlap itself; each play
rewinds to `currentTime = 0` first.

```typescript
preloadStrikeSound(munition); // idempotent - safe to call on every open
```

Call it **from a user gesture** — opening a sheet, presenting an alert. Mobile WebViews defer
audio work until the first gesture, and those moments are what turn the first strike of a session
from "fetch, decode, then play" into "play". Without it the bang lands _after_ the flash.

Playback failure is not fatal: it rejects, the hook warns and falls back to haptics, and the
visual still plays. Developing a new effect before its audio exists works fine.

## Adding a New Animation

1. **Check the distinctness table above** and pick axes nobody owns.
2. **Add the effect** to `ANIMATION_EFFECTS` in `src/animations/effects.ts` with a `label`,
   a `duration` matching your longest keyframe, and an `impactAtMs`. It joins `STRIKE_POOL`
   automatically.
3. **Add `src/components/shared/overlay/yourEffect.css`** and `@import` it from
   `OverlayAnimation.css`. Scope everything to `.overlay-animation.your-class`.
4. **Handle reduced motion**: leave a restrained variant _outside_
   `@media (prefers-reduced-motion: no-preference)` and the full spectacle inside. Degrade, do
   not disable — every existing effect does this.
5. **Review it in the Strike Range**: app menu > About > tap the build row 7x > Strike range.
   Fire it back to back against the rest of the pool; that is the only way to tell whether it
   actually reads as a different event.

### Styling guidelines

- Use `vmax`/`vmin` sizing so effects still cover the viewport in landscape.
- Animate `transform` and `opacity`; avoid `width`/`height`/`top`/`left`.
- For an expanding ring, use a **gradient band, not a `border`** — under `transform: scale()` a
  border thickens along with the element, whereas a gradient band scales proportionally, which is
  what a real shock front does.
- Keep total duration under ~2s.

## Technical Details

### Preventing simultaneous animations

A module-level flag in the hook ensures only one animation plays at a time. Triggering during an
active animation logs a warning and exits early.

### Cleanup

The hook clears its timeout on unmount and releases the global flag if it unmounts mid-animation.
Audio is never paused on unmount — calling `pause()` can interrupt `play()` and raise an
`AbortError`; sounds are short and complete naturally.

## Usage

```typescript
const [munition, setMunition] = useState<AnimationEffect>(pickStrike);
const { trigger, isActive, cssClass } = useOverlayAnimation(munition);

// Roll + preload when the confirm UI opens
useEffect(() => {
    if (!isOpen) return;
    const next = pickStrike();
    setMunition(next);
    preloadStrikeSound(next);
}, [isOpen]);

const handleConfirm = async () => {
    await trigger(munition);
    setTimeout(() => doTheDestructiveThing(), munition.impactAtMs);
};

return (
    <>
        {/* ... */}
        <OverlayAnimation cssClass={cssClass} />
    </>
);
```

`trigger` accepts an optional effect to fire instead of the hook's default. Use it whenever a
caller rolls a munition and fires it **in the same handler** — the callback closes over the
effect it was rendered with, so state set moments earlier would name one weapon and fire the
previous one. `ShoppingList.tsx` threads the rolled munition through its alert handler for
exactly this reason.
