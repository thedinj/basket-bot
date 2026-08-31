# 1. Location picker rewrite

**Status:** Not started
**Blocks:** [#2 Item editor modal rearrangement](./02-item-editor-modal-rearrangement.md)
**Surfaces affected:** shopping list item editor, store item editor

## Problem

Aisle and section are currently two stacked `ClickableSelectionField` rows. Three things
are wrong with it:

**Clearing a value is disproportionately painful.** To clear an aisle: tap the field →
the modal opens and _autofocuses its searchbar, so the keyboard immediately covers half
the list_ → scroll past every option to the footer → tap "Clear Selection". Two taps plus
an unwanted keyboard plus a hunt for a footer button, to erase one value.

**The aisle/section coupling is a trap.** `LocationSelectors.tsx` filters the section list
to the currently-selected aisle:

```ts
sections?.filter((section) => !currentAisleId || section.aisleId === currentAisleId);
```

So when the aisle is wrong, the section you want is **invisible**. You must clear the
aisle first, then pick the section (which re-sets the aisle correctly). That is the 4–5
tap path, and it is the common case after `Auto-Locate` guesses wrong.

**The searchbar autofocuses unconditionally.** `ClickableSelectionModal` calls
`searchbarRef.current?.setFocus()` in `onDidPresent`. For a store with 8 aisles this pops
a keyboard over a list you could have just read.

### Why not a collapsed summary row

An earlier draft proposed collapsing both fields behind a single `Produce › Bagged salad`
summary row. Rejected: section captions get long, and it adds a tap to reach a field that
is already too clicky. **The fix must not increase tap count on any path.**

## Supporting data

From `apps/backend/database.db`:

```sql
SELECT s.name AS store,
  (SELECT COUNT(*) FROM StoreAisle a WHERE a.storeId = s.id) AS aisles,
  (SELECT COUNT(*) FROM StoreSection x WHERE x.storeId = s.id) AS sections,
  (SELECT COUNT(*) FROM StoreSection x WHERE x.storeId = s.id AND x.aisleId IS NULL) AS orphans,
  (SELECT COUNT(*) FROM StoreItem i WHERE i.storeId = s.id) AS items
FROM Store s ORDER BY items DESC;
```

| Store                | Aisles | Sections | Orphan sections | Items |
| -------------------- | -----: | -------: | --------------: | ----: |
| Festival (Verona)    |     22 |  **229** |               0 |   306 |
| Costco (Verona)      |     17 |        4 |               0 |    80 |
| HyVee (Fitchburg)    |  **0** |    **0** |               0 |    76 |
| Walmart (Naples)     |     16 |       11 |               0 |    50 |
| Rondeaus             |      0 |        0 |               0 |    14 |
| Home Depot           |      0 |        0 |               0 |     8 |
| Trader Joes (Naples) |      0 |        0 |               0 |     7 |
| Admin Example Store  |      8 |        2 |               0 |     4 |

Design consequences, each of which the spec below depends on:

1. **Zero orphan sections** — every section has an aisle. The hierarchy is strictly
   two-level, so a single combined picker is safe. (Re-verify before relying on it; the
   schema permits `aisleId` to be NULL.)
2. **Scale varies enormously** — 0 to 22 aisles, 0 to 229 sections. Festival "Aisle 4"
   alone holds 45 sections and "Aisle 8" holds 39. The picker must be good at both ends.
3. **Half the stores have no structure at all.** Four of eight stores have zero aisles,
   and one of them (HyVee) is carrying 11 active list items. Today `ClickableSelectionField`
   disables the row when `items.length === 0`, so those users see a dead, unexplained
   control.
4. **Aisle names are numeric** — "Aisle 3", "Aisle 4", "Aisle 10", "Aisle 11". Natural
   sort is required (`naturalSort` from `utils/stringUtils` already does this) and search
   by bare number must work.
5. **Location coverage is poor and matters.** Only 8 of 34 active list items have an
   aisle, 3 have a section, and 131 of 545 catalog items (24%) are uncategorized — while
   aisle grouping is the core in-store value of the app. This field needs to get _easier_,
   not quieter.

## Design

### A. Inline chips with per-chip clear (this is the part that fixes the complaint)

Replace the two rows with one Location row whose value renders as chips, each carrying its
own clear affordance:

```
Location                                    [AI]
  < Aisle 4  x >   < Bagged salad  x >
```

- **Clearing never opens a modal.** Tapping the x on a chip clears that value in place:
  one tap, down from two plus a keyboard plus a footer hunt.
- Long captions stop being a layout problem — chips wrap to a second line and each
  truncates independently, instead of one long ellipsized string.
- Empty state is a single `< Set location >` chip.
- Tapping anywhere on the row other than an x opens the picker.
- The existing `Auto-Locate` `LLMButton` stays exactly where it is, with its current
  behavior (including the "Override Location?" confirm when values already exist).

Clearing rules, unchanged from current semantics:

- Clearing the **section** leaves the aisle set.
- Clearing the **aisle** also clears the section (a section cannot outlive its aisle).

### B. One combined picker modal

```
+-- Set Location ------------------ x --+
|  [search]  Search aisles & sections   |   <- NOT autofocused
+---------------------------------------+
|   Aisle 3                           > |
|   Aisle 4                           v |   <- expanded
|       - no section -                  |
|       Bagged salad                    |
|       Berries                         |
|       ...                             |
|   Aisle 5                           > |
+---------------------------------------+
|            Clear location             |
+---------------------------------------+
```

**Selection behavior, tuned to the data:**

- **Aisle with no sections → tap commits it and closes.** Costco (4 sections across 17
  aisles), Walmart (11 across 16), and the example store become plain 2-tap aisle
  pickers. This is the majority of stores.
- **Aisle with sections → tap stages that aisle (row highlights) and expands it.** Then:
    - tapping a section commits aisle + section and closes; or
    - tapping the pinned first child `- no section -` commits aisle-only and closes.

    Both paths are two taps.

- **Search flattens across both levels at once.** Results list aisles and sections
  together, each section showing its aisle as a subtitle. This is what removes the
  coupling trap: you can jump directly to a section in a _different_ aisle without
  clearing anything first. Reuse the existing 4-tier match ranking in
  `ClickableSelectionModal` (starts-with label → starts-with search term → contains label
  → contains search term).
- **Do not autofocus the searchbar.** Open with the current selection expanded and
  scrolled into view. Browsing beats typing at 22 rows; the keyboard is pure obstruction.
  Focus only when the user taps the searchbar.
- Footer `Clear location` clears both values and closes.

**Empty state (four of eight stores):** instead of a silently disabled row, show
"No aisles set up for this store" with an action routing into aisle/section management
(`AislesSectionsManagementModal`). Getting these stores structured is what makes the whole
in-store grouping work.

### C. Field interaction rules

These are already correct in `LocationSelectors.tsx` — carry them over verbatim:

- Selecting a section always sets its parent aisle.
- Selecting an aisle clears the section **only if** the section does not belong to that
  aisle.
- Clearing the aisle clears the section.

**Normalization rule — call this out in review.** Per `CLAUDE.md`: _if an item has a
section, the section aisle is authoritative and the item `aisle_id` is NULL._ The form
holds both `aisleId` and `sectionId` in local state, so whatever the picker produces must
still satisfy that rule by the time it reaches the API. Do not change the persistence
contract in this task; just make sure the picker output does not violate it.

## Tap count acceptance targets

| Action                                             |                      Today | Required after |
| -------------------------------------------------- | -------------------------: | -------------: |
| Clear aisle or section                             | 2 + keyboard + footer hunt |          **1** |
| Pick a section in the currently-selected aisle     |                          2 |              2 |
| Pick a section in a **different** aisle            |                        4–5 |          **2** |
| Pick an aisle that has no sections                 |                          2 |              2 |
| Pick an aisle that has sections, no section wanted |                          2 |              2 |

No path may get longer.

## Files

**Rewrite:**

- `apps/mobile/src/components/shared/LocationSelectors.tsx` — the two-field layout becomes
  the chip row; owns the aisle/section coupling rules and the `Auto-Locate` button.

**New:**

- `apps/mobile/src/components/shared/LocationPicker.tsx` — the combined accordion modal.
- `apps/mobile/src/components/shared/LocationPicker.scss` — chip and accordion styling.

**Consumers (should need no changes if the props stay stable — verify both):**

- `apps/mobile/src/components/shoppinglist/LocationSelectors.tsx` (thin wrapper) →
  `ItemEditorModal.tsx`
- `apps/mobile/src/components/shared/ItemNameAndLocationFields.tsx` →
  `apps/mobile/src/components/storeitem/StoreItemEditorModal.tsx`

**Read for context, do not change:**

- `apps/mobile/src/components/shared/ClickableSelectionModal.tsx` — source of the search
  ranking logic to reuse.
- `apps/mobile/src/components/shared/ClickableSelectionField.tsx` — still used by
  `UnitSelector` and others; leave it alone.

`LocationSelectors` is generic over `T extends FieldValues` and is driven by react-hook-form
`control` / `setValue` / `watch` with field names `aisleId` and `sectionId`. Keep that
contract.

## Acceptance criteria

- [ ] Clearing an aisle or a section takes exactly one tap and never opens a modal.
- [ ] A section in a non-selected aisle is reachable in two taps via search, without
      clearing the aisle first.
- [ ] Aisles with no sections commit immediately on tap.
- [ ] The picker searchbar does not steal focus on open.
- [ ] Aisles sort naturally: Aisle 2, Aisle 3, Aisle 10, Aisle 11 — not Aisle 10, Aisle 11,
      Aisle 2.
- [ ] Searching `4` finds "Aisle 4".
- [ ] Selecting a section sets its aisle; changing to an incompatible aisle clears the
      section; clearing the aisle clears the section.
- [ ] A store with zero aisles shows an explanatory empty state with a route into aisle
      management — not a disabled row.
- [ ] Both consumers (`ItemEditorModal`, `StoreItemEditorModal`) render and save correctly.
- [ ] `Auto-Locate` still works, including the override confirmation.
- [ ] Renders correctly at 320px width; chips wrap rather than overflow.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` clean.

## Out of scope

- Creating aisles/sections from inside the picker (route to the existing management modal).
- Changing how `aisleId`/`sectionId` are persisted or normalized server-side.
- Changing the `Auto-Locate` LLM behavior.
- `ClickableSelectionField` / `ClickableSelectionModal` themselves — other fields depend on
  them unchanged.
