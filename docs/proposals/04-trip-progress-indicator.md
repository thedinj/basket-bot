# 4. Trip progress indicator

**Status:** Not started
**Depends on:** nothing

## Problem

While shopping there is no answer to "how much is left?" without scrolling the whole list.
The obvious fix — a count in the header — costs vertical space, and the list itself must
stay the prominent thing on a small screen. So the indicator has to be essentially free in
layout terms while still being genuinely nice to look at.

## Scope

One thing: a **2px progress line** flush under the app header, with a glow and motion.

## Design

A 2px bar spanning the full width, sitting directly beneath the header toolbar so it reads
as part of the chrome rather than as list content.

**Value:** `checkedItems.length / activeItems.length`, computed from the same arrays
`ShoppingList.tsx` already derives. Snoozed items are excluded when the snoozed filter is
off — use `activeItems`, so the denominator matches what the user can actually see.

**Make it attractive.** This is the one place in this batch where flourish is wanted:

- **Fill transition** — animate `width` (or better, `transform: scaleX()` for compositing)
  with a soft ease-out, ~400ms. Every check-off should visibly *advance* the bar, not
  teleport it.
- **Glow** — a `box-shadow` bloom in the fill color, intensity scaling with progress, so
  the bar gets subtly brighter as the trip nears completion.
- **Colour travel** — fill as a gradient that shifts from `--ion-color-primary` toward
  `--ion-color-success` as progress increases. Green already means "checked" in this app
  (`CheckedItems` uses `--ion-color-success` for its header), so the vocabulary is
  consistent.
- **Shimmer** — a slow highlight sweep across the filled portion while progress is
  between 0 and 100%. Keep it subtle and low-frequency; this sits on screen for a whole
  shopping trip and must not become irritating.
- **Completion moment** — at 100%, a brief pulse/flare, then settle to a steady full bar.
  This lands right before the Obliterate flow, which already has the laser animation, so
  keep it short and do not compete with it.
- **Zero state** — at 0% render the track only (a faint neutral line), no glow, no
  shimmer.

**Constraints:**

- Total added height must be ~2px. No labels, no padding, no extra toolbar.
- Respect `prefers-reduced-motion`. The repo uses both idioms — see
  `components/shared/OverlayAnimation.css` (`no-preference`) and
  `components/shared/RobotLoadingContent.css` (`reduce`). Under reduced motion: keep the
  fill and the colour, drop the shimmer, the pulse, and ideally the transition.
- Must work in both themes. Define colours from Ionic/theme CSS variables, not literals —
  see `apps/mobile/src/theme/variables.scss`, which defines light and dark values for
  custom tokens such as `--app-color-ideas`.
- Hide the bar entirely when the list is empty (the page already renders a dedicated empty
  state).

**Placement:** `AppHeader` is a shared component
(`apps/mobile/src/components/layout/AppHeader.tsx`) used by several pages, so do not
hard-code shopping-list logic into it. Add an optional prop — e.g.
`progress?: number | null` (0–1, `null`/undefined renders nothing) — and render the bar as
the last element inside `IonHeader`, after the toolbars. That keeps it pinned during
scroll for free. `ShoppingList.tsx` passes the computed value.

## Files

- `apps/mobile/src/components/layout/AppHeader.tsx` — optional `progress` prop, renders the
  bar.
- **New:** `apps/mobile/src/components/layout/ProgressLine.tsx` + `.scss` — the bar itself,
  self-contained and reusable.
- `apps/mobile/src/pages/ShoppingList.tsx` — compute and pass progress. The `checkedItems`
  and `activeItems` arrays already exist in `ShoppingListWithItems`.
- `apps/mobile/src/theme/variables.scss` — only if new tokens are genuinely needed; prefer
  existing ones.

## Acceptance criteria

- [ ] The bar adds no more than ~2px of vertical height and never pushes list content down
      noticeably.
- [ ] Progress reflects checked / total among *visible* (non-snoozed, unless shown) items.
- [ ] The fill animates smoothly on each check-off rather than jumping.
- [ ] Glow, gradient travel, and shimmer are present and look deliberate — not a plain
      flat bar.
- [ ] 100% triggers a brief completion flourish that does not clash with the existing
      laser obliteration animation.
- [ ] Under `prefers-reduced-motion`, shimmer and pulse are disabled and the bar still
      conveys progress.
- [ ] Correct in both light and dark themes; all colours come from theme variables.
- [ ] Nothing renders when the list is empty, and `AppHeader` is visually unchanged on
      every other page that uses it.
- [ ] Verified at 320px width.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` clean.

## Out of scope

- **Per-aisle remaining counts on group headers** — considered and declined; not helpful
  enough to justify the noise. Do not add badges to `GroupHeader`.
- A numeric "8 of 23" header row — rejected; the list must stay prominent.
- Sound effects.
- Any change to how items are grouped, sorted, or checked.
