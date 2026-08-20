# 2. Item editor modal rearrangement

**Status:** Not started
**Depends on:** [#1 Location picker rewrite](./01-location-picker-rewrite.md)
**Feeds:** [#3 Swipe actions](./03-shopping-list-swipe-actions.md) consumes the `SnoozeChips` component created here

## Problem

`ItemEditorModal` (Item mode) stacks eight full-width rows in this order:

```
Name → Quantity → Unit → Aisle → Section → [Unsure][Incognito] → Snooze Until → Notes → Save
```

The ordering does not match how the fields are actually used. Notes — the only field that
requires the user to *think*, and the one most often filled on manual entry — is dead last
and is a single-line `IonInput` that visibly truncates real content. Quantity and Unit each
occupy a full row despite being used on 2 of 13 manual items, and Unit additionally costs a
searchable sub-modal. Snooze occupies a premium row above Notes and is used on nothing.

## Supporting data

From `apps/backend/database.db`. The naive fill rates are misleading, so split by origin —
recipe-added items get `notes` written by the server (`recipeService.addRecipeToShoppingList`
sets `notes: recipe.name`) and inherit qty/unit from the recipe:

```sql
WITH tagged AS (
  SELECT sli.*, (SELECT 1 FROM Recipe r WHERE r.name = sli.notes) AS fromRecipe
  FROM ShoppingListItem sli
)
SELECT CASE WHEN fromRecipe = 1 THEN 'recipe-added' ELSE 'manual' END AS source,
       COUNT(*) total,
       SUM(qty IS NOT NULL) has_qty,
       SUM(unitId IS NOT NULL) has_unit,
       SUM(notes IS NOT NULL AND TRIM(notes) <> '') has_notes,
       SUM(isUnsure = 1) unsure, SUM(isPrivate = 1) private
FROM tagged GROUP BY 1;
```

| Source | n | qty | unit | notes | unsure | private |
| ------ | -: | --: | ---: | ----: | -----: | ------: |
| Recipe-added | 22 | 100% | 82% | 100% (machine-written) | 23% | 5% |
| **Manual** | 13 | **15%** | **15%** | **23%** | 8% | 8% |

Key points:

- **Raw notes fill rate is 71%, but that collapses to 23% once machine-written recipe
  names are excluded.** Only three notes in the whole database were written by a human:
  *"For Clara/kiddie cocktails"*, *"Ripe, not green"*, *"Cookout foods"*. Notes is still
  used more than qty or unit on manual entry, and it is the only field requiring thought —
  so it earns promotion, just not as dramatically as the raw number suggests.
- **The longest note is 45 characters** ("Baked stuffed brie with cranberries & walnuts").
  A single-line `IonInput` truncates it.
- **`snoozedUntil` is 0 of 35** — not one item in the database is snoozed. (Caveat: snooze
  is transient, so a point-in-time snapshot understates lifetime use. It still does not
  justify outranking Notes.)
- **The editor is genuinely reused** — 10 of 35 items (29%) have `updatedAt > createdAt`.
  This is not a write-once form.

## Design

```
CURRENT (Item mode)                 PROPOSED
--------------------------          --------------------------------------------
Name                                Name
Quantity          <- 15%            Notes         (textarea, autoGrow, ~3 rows)
Unit              <- 15%            [ Qty ][ Unit ]        (one row, side by side)
Aisle                               Location      (chips, from task #1)
Section                             ---------------------------------
[Unsure][Incognito]                 [Unsure][Incognito]
Snooze Until      <- 0%             Snooze  [Tomorrow][1 wk][Pick date...]
Notes  (1 line)   <- 23%            [ Save ]
[ Save ]
```

Four changes, in value order:

### A. Notes → position 2, as an auto-growing textarea

- Swap `IonInput` for `IonTextarea` with `autoGrow`, `rows={3}`.
- Keep `autocapitalize="sentences"`, the `MAX_NOTES_LENGTH` validation, and the existing
  error display.
- Idea mode already leads with Notes (labelled "Idea") — that stays as is.

### B. Quantity + Unit merge onto one row

- They are one concept ("2 bags"), and per the data they are empty together 85% of the
  time. Merging removes a row.
- Layout: narrow numeric input for qty, compact selector for unit, on a single flex row
  under one "Quantity" stacked label.
- Unit keeps using `ClickableSelectionField`; it just gets a constrained width instead of
  a full row. Do not change `useUnitItems` or the unit modal.
- Preserve the existing behavior where an empty qty parses to `null`, not `0` or `NaN`.

### C. Location becomes the single chip row from task #1

If task #1 has not landed yet, **leave the two existing aisle/section rows in place** and
reorder around them. Do not build an interim collapsed version — it was explicitly
rejected during scoping.

### D. Snooze becomes a chip row

Replace the full row + `IonDatetime` sub-modal with:

```
Snooze   [ Tomorrow ]  [ 1 wk ]  [ Pick date... ]
```

- `Tomorrow` and `1 wk` set the value directly, no modal.
- `Pick date...` opens the existing `IonDatetime` sheet, unchanged.
- When a value is set, the active chip renders selected, with a clear affordance —
  clearing must stay one tap (`clearSnooze` today is already one tap; do not regress it).
- Keep the existing minimum-date rule (start of tomorrow) and reuse
  `formatSnoozeDateForStorage` / `formatSnoozeDate` from `utils/dateUtils` so storage stays
  normalized to midnight UTC.
- Keep the existing rule that the whole control is hidden when editing a checked item.

**Extract the chips into `apps/mobile/src/components/shoppinglist/SnoozeChips.tsx`** so
task #3 can reuse it from the swipe action. The component should take a value and an
`onChange`, and be usable both inside the react-hook-form `Controller` (here) and driven
directly by a mutation (task #3). Keep the preset offsets in one exported constant so both
surfaces agree on what "1 wk" means.

Net: eight stacked rows down to six, with Name and Notes both above the fold on a small
screen.

## Files

- `apps/mobile/src/components/shoppinglist/ItemEditorModal.tsx` — field order for both
  Item and Idea mode.
- `apps/mobile/src/components/shoppinglist/NotesInput.tsx` — textarea conversion.
- `apps/mobile/src/components/shoppinglist/QuantityInput.tsx` +
  `UnitSelector.tsx` — merged onto one row. Consider a single `QuantityAndUnitRow.tsx`
  that composes both rather than cross-wiring them.
- `apps/mobile/src/components/shoppinglist/SnoozeDateSelector.tsx` — becomes the chip row.
- **New:** `apps/mobile/src/components/shoppinglist/SnoozeChips.tsx` (+ `.scss`) — shared
  with task #3.

Do not change `shoppingListItemInputSchema` in `packages/core` — this is a layout task, not
a data task. The form contract (`ItemFormData`) stays identical.

## Acceptance criteria

- [ ] Field order in Item mode is Name → Notes → Qty+Unit → Location → flags → Snooze → Save.
- [ ] Notes is a multi-line auto-growing textarea and does not truncate a 45-character note.
- [ ] Quantity and Unit occupy one row; an empty quantity still saves as `null`.
- [ ] Snooze presets set a date without opening a modal; `Pick date...` still opens the
      date sheet; clearing a snooze is one tap.
- [ ] `SnoozeChips` is importable standalone (no react-hook-form dependency in its props).
- [ ] Idea mode still shows only Notes / flags / snooze and saves correctly.
- [ ] Editing an existing item still pre-fills every field, including the rule that clears
      `snoozedUntil` for checked or past-dated items.
- [ ] Save and delete paths unchanged; the store-item merge-on-rename behavior in
      `onSubmit` still works.
- [ ] At 320px width, Name and Notes are both visible without scrolling.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` clean.

## Out of scope

- Any schema or API change.
- Separating recipe provenance out of `notes` into a `sourceRecipeId` column — discussed
  and deferred; would be its own task with a migration.
- Changing validation rules or max lengths.
- The Item/Idea mode toggle chips at the top of the modal.
