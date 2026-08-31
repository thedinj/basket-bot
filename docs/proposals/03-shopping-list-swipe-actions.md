# 3. Shopping list swipe actions

**Status:** Not started
**Depends on:** [#2](./02-item-editor-modal-rearrangement.md) for the `SnoozeChips` component (see note below)

## Problem

Every per-item action on the shopping list costs a full modal round trip. Marking an item
unsure is: tap row → modal opens → scroll to the flags row → toggle → Save → modal closes.
Snoozing is the same plus a date picker. Both are things you do _while walking through a
store_, one-handed, and both should be a single gesture.

There is no `IonItemSliding` anywhere in `components/shoppinglist/`. The pattern already
exists in the codebase — see `apps/mobile/src/components/store/SectionList.tsx:213` — so
this is applying an established convention, not introducing one.

## Scope

Two swipe actions, both on **unchecked** rows:

1. **Unsure toggle** — flips `isUnsure` on the item.
2. **Snooze presets** — `1d` and `1w` chips that set `snoozedUntil` directly.

Deleting is deliberately **not** included: it is rare in practice and destructive gestures
on a list you are actively working is a bad trade. Move-to-store is also excluded — it
already has a dedicated button on the row.

## Design

- Wrap `ShoppingListItem` in `IonItemSliding` with a single `IonItemOptions`.
- **Do not let the swipe compete with the checkbox.** The checkbox lives in a
  `slot="start"` div with its own click handler; verify that horizontal drag from the left
  edge does not fight it, and set the options side accordingly (prefer `side="end"` so the
  gesture starts away from the checkbox).
- The revealed options are buttons, not a menu — no popup, no date picker:

```
[ item row ..................... ]  < swipe
                    [ Unsure ] [ 1d ] [ 1w ]
```

- **Unsure** shows the current state (use `helpCircle` / `helpCircleOutline`, matching the
  row icon logic already in `ShoppingListItem.tsx`) and toggles it.
- **1d / 1w** set `snoozedUntil` to start-of-day tomorrow / one week out. Reuse the preset
  offsets and `formatSnoozeDateForStorage` from the `SnoozeChips` work in task #2 so the
  two surfaces cannot drift on what "1 wk" means.
- Close the sliding item after an action fires (`closeOpened()` on the sliding ref).
- Haptics: the row already fires `Haptics.impact({ style: ImpactStyle.Light })` on check.
  Match that for swipe actions.
- The existing snooze Zzz particle animation in `ShoppingListItem.tsx` triggers when an
  item transitions into the snoozed state — it should fire naturally from the swipe path
  too. Verify it does.

### Where the actions apply

- **Unchecked, non-idea rows:** both actions.
- **Ideas:** `isUnsure` and `snoozedUntil` are both valid on ideas (see
  `shoppingListItemSchema`), so allow both.
- **Checked rows:** no swipe actions. Checking an item already clears `snoozedUntil`
  server-side (`toggleShoppingListItemChecked`), and the editor hides the snooze control
  for checked items — stay consistent.
- **Unsure review mode:** `ShoppingListItem` has an alternate mode driven by
  `onConfirmUnsure` / `onRejectUnsure` (used by `UnsureItemsModal`). Disable swipe
  entirely in that mode — the row already has explicit confirm/reject buttons.

## Data / mutations

Both actions go through `useUpsertShoppingListItem` in `apps/mobile/src/db/hooks.ts`.
Note that `upsertShoppingListItem` on the backend takes the **full** item state — it is a
replace, not a patch — so the mutation must send the item's other current field values
along with the changed one, or they will be nulled. Follow the payload construction in
`apps/mobile/src/utils/shoppingListItemPayload.ts` and the pattern already used by
`handleConfirmMove` in `ShoppingListItem.tsx`, which spreads the item's fields explicitly.

**Optimistic update is worth it here** — the whole point is that the gesture feels
instant. If you add one, follow the existing optimistic pattern in `useToggleItemChecked`.

**Cache invalidation:** invalidate `queryKeys.shoppingListItems.byStore(storeId)`. Check
[`apps/mobile/docs/CACHE_KEYS.md`](../../apps/mobile/docs/CACHE_KEYS.md) for anything else
that surfaces `isUnsure` / `snoozedUntil` and update that doc in the same change if the
cascade changes.

**Error handling:** pass `meta: { operation: "..." }` (e.g. `"snooze item"`,
`"mark item unsure"`) and let the global `MutationCache.onError` in `DatabaseContext.tsx`
show the toast. **Do not add a per-hook `onError` toast** — that produces a double toast.

## Files

- `apps/mobile/src/components/shoppinglist/ShoppingListItem.tsx` — wrap in
  `IonItemSliding`, add the options.
- `apps/mobile/src/components/shoppinglist/ShoppingListItem.css` — option styling.
- `apps/mobile/src/components/shoppinglist/SnoozeChips.tsx` — created in task #2; import
  the preset offsets from here. **If task #2 has not landed, create this file at that path
  with the shared preset constants** so #2 can consume it as-is.
- `apps/mobile/src/db/hooks.ts` — only if a dedicated mutation hook is warranted; prefer
  reusing `useUpsertShoppingListItem`.

**Read for the existing pattern:** `apps/mobile/src/components/store/SectionList.tsx`.

## Acceptance criteria

- [ ] Swiping an unchecked row reveals Unsure / 1d / 1w.
- [ ] The swipe gesture does not interfere with tapping the checkbox or opening the editor.
- [ ] Unsure toggles both directions and the row's unsure styling/icon updates immediately.
- [ ] 1d and 1w set the snooze date; the row shows "Snoozed until ..." and the Zzz
      animation fires.
- [ ] Snooze presets from swipe and from the editor produce identical stored values.
- [ ] Other fields on the item (qty, unit, notes, private, idea) are unchanged after a
      swipe action — verify against the DB, since upsert replaces.
- [ ] The sliding row closes after an action.
- [ ] No swipe actions on checked rows or in unsure-review mode.
- [ ] Snoozing respects the existing show/hide-snoozed filter on the page.
- [ ] A failed mutation surfaces exactly one toast.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` clean.

## Out of scope

- Swipe-to-delete.
- Swipe-to-move-to-store.
- Quantity adjustment from the row.
- Reviving the `SHOW_UNSURE_ONLY_FILTER` flag in `ShoppingList.tsx` (currently `false`) or
  changing `UnsureItemsModal` — leaving both as they are was an explicit decision.
