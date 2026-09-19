# Mobile Design System ("Highway")

The visual language of the mobile app. The shopping list, the item / store-item / aisle
editors, the Recipes tab and the Meal Plans tab are the reference implementations; read one of
them alongside this document before restyling a screen.

The idea: **US highway signage**. Clear sans lettering, numbered shield plates, ruled section
labels, and strict alignment to a single gutter. Dry and precise, like the app's deadpan-robot
voice. No decoration that doesn't carry information.

Where things live:

| What                                                                        | File                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| Font stacks, `ion-title`, tab labels, `.ruled-label`                        | `src/theme/typography.scss`                      |
| Form system (`.editor-form`, `.form-field`, `.form-control`, submit button) | `src/theme/forms.scss`                           |
| Shared patterns (see §4's building-block table)                             | `src/theme/patterns.scss`                        |
| Color tokens, light/dark palettes, tag palette                              | `src/theme/variables.scss`                       |
| `FormField` component                                                       | `src/components/shared/FormField.tsx`            |
| Shield plate (`AislePlate`)                                                 | `src/components/shared/AislePlate.tsx` / `.scss` |
| Grouped list headers (aisle bars, section labels)                           | `src/components/shared/GroupedItemList.scss`     |
| Fonts (bundled, never fetched)                                              | `@fontsource/*` imports in `src/App.tsx`         |

---

## 1. Geometry

- **The 16px gutter.** Every screen's content starts at x = 16 and ends at width − 16. Labels,
  field boxes, card edges, list text, footer buttons: all of them. If something is inset 12px
  or 14px from the screen edge, it is wrong.
- **Inside a box, 12px.** Text inside a field box, a card, or a boxed list starts 12px in.
  Recipe cards and plan cards use a 12px inset; field boxes use `padding-inline: 12px`.
- **Pull icon buttons onto the line.** A 36px icon button with a 20px glyph has 8px of its own
  inset. When it is the first or last thing on a row, pull it with `margin-inline: -8px` so the
  **glyph** edge lands on the gutter or inset, not the button's invisible edge.
- **Spacing scale (4px base):** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32. Fields sit 20px
  apart; cards in a list 12px apart; a label sits 8px above its control.
- **Sizes that recur:**
    - 48px: field boxes, primary/submit buttons, back squares in footers
    - 44px: search fields, filter buttons, toolbar rows, minimum touch targets
    - 40px: card action bars
    - 36px: row icon buttons (20px glyphs)
    - 32px: preset/sort chips, compact inputs
    - 28px: pills (`.form-field__action`, active-filter chips, md tag chips)
    - 20px: small tag chips and info pills
- **Radii:** 10px for field boxes and buttons, 14px for cards, 8px for 32px chips/inputs,
  fully rounded for pills. Plates are 5px.
- **Use `gap`, not margins,** for sibling spacing. Components carry no outer margin; their
  container spaces them (e.g. `TagChip` has `margin: 0`, and its list sets `gap: 4px`).
- **Align columns on purpose.** Use CSS grid (and `subgrid`) so columns line up across rows:
  amounts as wide as the widest amount, numerals right-aligned in a fixed column, action bars
  with equal columns that are _always present_ (disable instead of removing, so bars line up
  card to card).

## 2. Type

Four registers, each with a job. Don't introduce a fifth.

| Register | Font                                                                | Used for                                                                                                                         |
| -------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Body     | **Barlow** (`--ion-font-family`), 400–700                           | Everything by default: names, titles, prose, buttons, counts in text                                                             |
| Display  | **Barlow Condensed** (`--app-font-display`), 600, uppercase, 0.08em | Field labels (13px), tab labels, step labels, small status caps ("SKIPPED")                                                      |
| Sign     | **Overpass** (`--app-font-sign`), 800, uppercase                    | Aisle names in the shopping list's header bars only                                                                              |
| Data     | **JetBrains Mono** (`--app-font-mono`)                              | Rarely: a count after a label (`.ruled-label__count`), the robot's terminal lines. **Not** for quantities, dates, meta or chips. |

Monochrome **Noto Emoji** (`--app-font-emoji`) draws aisle emoji on plates.

Rules:

- Use a **rem scale**: 0.75 (12px) · 0.8125 (13) · 0.875 (14) · 0.9375 (15) · 1 (16) · 1.0625
  (17) · 1.25 (20) · 1.75 (28) · 3.5 (56). Nothing below 11px; 10px text doesn't read on a phone.
- **Numbers use `font-variant-numeric: tabular-nums`** wherever they can change or stack (counts,
  quantities, times, scale factors), so digits don't jitter and columns line up.
- **Quantities** use the shopping-list style: Barlow 600, 0.90625rem, tabular, lilac
  (`--ion-color-secondary`), `white-space: nowrap`. Format with `formatQuantity` /
  `formatQuantityWithUnit` from `src/utils/quantity.ts` (trims float noise).
- **Titles**: card/row titles 1rem/1.2 bold, sheet titles 1.75rem bold. Page titles
  (`ion-title`) are Barlow 600 1.25rem; leave them alone.
- **Secondary text** (source, meta, hints): 0.8125rem, weight 500–600, `--ion-color-medium`.
- **Meta lines** ("12 ingredients · 3 recipes", "2 of 4 filled"): Barlow 600, 0.8125–0.875rem,
  tabular, medium color. Separate facts with " · ".
- Don't set `font-family: "JetBrains Mono"` or hard-code pixel `font-size`s in new CSS. Use the
  variables and rems.

## 3. Color

Palette roles (see `variables.scss`; light and dark are both defined, so **only use tokens**):

- `--ion-color-primary` (royal purple): primary buttons, focus rings, the active state of
  controls, progress.
- `--ion-color-secondary` (**lilac**): the information accent. Section labels, quantities, plate
  outlines, numerals, "set" values, small actions (`.form-field__action`).
- `--ion-color-medium`: secondary text, idle icons, meta.
- `--ion-color-warning`: unsure / needs attention (amber tints).
- `--ion-color-danger`: destructive actions only.
- Surfaces and lines: `--ion-background-color` for pages; `--ion-color-step-50` fills field
  boxes; `--ion-color-step-150` is the **hairline** (dividers, card borders);
  `--ion-color-step-200` borders field boxes.
- Card surface: `var(--ion-card-background, var(--ion-item-background, var(--ion-background-color)))`.
- Tints come from `color-mix(in srgb, <token> N%, transparent)`, never from rgba literals of a
  hex (`rgba(124, 58, 237, .2)` is wrong in light mode; the purple differs).
- **No fallback hex colors** (`var(--ion-border-color, #2d3748)`): the tokens always exist.
- Selected/active chips: 15% lilac fill, 45% lilac border, lilac text. Focus: primary border plus
  a `0 0 0 3px` 22% primary ring.

Avoid: gradients (except the existing first-tag wash on recipe and slot cards), colored side
stripes (`border-left: 3px solid …`), glows, drop shadows on cards.

## 4. Components and patterns

### Shared building blocks: use these, don't copy them

Before writing CSS for any of the following, use the shared version. Screens used to each keep a
private copy; those copies drifted apart.

| Need                                                                           | Use                                                                                                  | Where                                                                            |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A sheet header (title, Close, optional info button, pinned content below)      | `<ModalHeader title onClose actions?>`                                                               | `components/shared/ModalHeader.tsx`                                              |
| A plain text field bound to react-hook-form                                    | `<TextField name control label hint?>`                                                               | `components/form/TextField.tsx`                                                  |
| A password field (show/hide) bound to react-hook-form                          | `<PasswordField name control label autocomplete>`                                                    | `components/form/PasswordField.tsx`                                              |
| A modal footer with the primary action (optional back square)                  | `<EditorFooter onBack?>` + `IonButton expand="block" className="editor-form__submit"`                | `components/shared/EditorFooter.tsx`, `.editor-footer` in `forms.scss`           |
| Secondary text under a field                                                   | `<FormField hint=…>` (`.form-field__hint`)                                                           | `FormField.tsx`, `forms.scss`                                                    |
| A select / toggle inside a field box                                           | just put `IonSelect` / `IonToggle` in `.form-control`; it's styled                                   | `forms.scss`                                                                     |
| A read-only value in a field box                                               | `.form-control.form-control--readonly`                                                               | `forms.scss`                                                                     |
| A label-line pill used on its own row                                          | `.form-field__action.form-field__action--standalone`                                                 | `forms.scss`                                                                     |
| The robot's terminal aside                                                     | `<RobotLine cursor?>` (`.robot-line`)                                                                | `components/shared/RobotLine.tsx`, `patterns.scss`                               |
| Screen-reader-only text                                                        | `.sr-only`                                                                                           | `patterns.scss`                                                                  |
| A whole-row `<button>`                                                         | `.row-button` (reset, pressed tint, focus ring; geometry is yours)                                   | `patterns.scss`                                                                  |
| A card frame                                                                   | `.surface-card` (14px radius, hairline, card surface)                                                | `patterns.scss`                                                                  |
| Edge-to-edge row buttons with hairlines on the gutter                          | `.gutter-rows` (`--ruled` for a hairline above the first)                                            | `patterns.scss`                                                                  |
| A list drawn as one field box                                                  | `.boxed-list` (rows get hairlines between them)                                                      | `patterns.scss`                                                                  |
| A 20px status tag                                                              | `.info-pill` (`--accent`, `--warn`)                                                                  | `patterns.scss`                                                                  |
| A label / value table                                                          | `<dl className="tally">` (`.tally__quiet` for muted rows)                                            | `patterns.scss`                                                                  |
| An amount                                                                      | `.qty` (`.qty__from` for the unscaled "1 →" part)                                                    | `patterns.scss`                                                                  |
| An ingredient / item row with Include + Unsure toggles                         | `.review-list` > `.review-row` (`__toggles`, `__text`, `__name`, `.qty`, `__note`, `__end`, `--off`) | `patterns.scss`                                                                  |
| A search field                                                                 | `IonSearchbar className="search-field"`                                                              | `patterns.scss`                                                                  |
| A card's footer action bar                                                     | `.card-actions` > `.card-actions__btn` (`--on`)                                                      | `patterns.scss`                                                                  |
| A 32px choice chip (sort, time, scale)                                         | `.preset-chip` (`--active` / `aria-pressed`, `--accent`)                                             | `patterns.scss`                                                                  |
| A small icon button inside a field box or panel header (clear, remove a photo) | `.form-control__icon-button` (`--end` pulls it onto the box inset)                                   | `forms.scss`                                                                     |
| Delete / leave the thing a sheet is about                                      | `<DestructiveAction>` (see "Deleting")                                                               | `components/shared/DestructiveAction.tsx`, `.destructive-action` in `forms.scss` |
| Remove one row from a list                                                     | `<RowRemoveButton label>` (see "Deleting")                                                           | `components/shared/RowRemoveButton.tsx`, `.row-remove` in `patterns.scss`        |

**Load order trap.** The theme files (`typography.scss`, `forms.scss`, `patterns.scss`) are
imported in `App.tsx` _after_ the component tree, so their CSS lands after every component's
stylesheet. A single-class rule in a component (`.my-row { margin: 0 16px }`) loses to a shared
class on the same element at equal specificity. Adjust a shared class with a compound selector:
`.ruled-label.my-label`, `.row-button.my-row`, `.robot-line.my-line`.

### Section labels: `.ruled-label`

Small bold tracked caps in lilac with a hairline running to the edge. It's the heading for
every group inside a sheet or page (Ingredients, Steps, Scale recipes, Dispatched…).
Use `<h2 className="ruled-label">`. Put a trailing count in `.ruled-label__count`.

**Specificity trap:** `.ruled-label` sets `margin: 0` and loads late, so a lone modifier class
(`.my-label { margin: 0 16px }`) silently loses. Write it compound:
`.ruled-label.my-label { … }`.

### Forms: `theme/forms.scss` + `FormField`

- Wrap the form in `.editor-form` (a grid with 20px gaps).
- Each field is `<FormField label="…" action={…}>` holding a `.form-control` box: 48px, 10px
  radius, 12px inset, step-200 border, step-50 fill. Ionic inputs inside lose their own chrome.
- Labels are 13px condensed caps in medium color. A small action on the label line (Auto-Locate,
  Manage, Roll) is a `.form-field__action` pill (28px, lilac).
- Variants: `.form-control--multiline` (textarea), `.form-control--button` (a box you tap to
  pick something).
- Two short fields side by side: a 2-column grid with a 12px gap.
- Toggles in a box: `IonToggle labelPlacement="start" justify="space-between"`. The label is
  **fixed and names what "on" does** ("Include in pool", "Show in store lists", "Copy store
  items"). Never swap the label with the state ("In pool" / "Left out"): the switch already
  shows the state, and a changing label next to a switch reads backwards (an off switch beside
  "Shown in store lists" looks like "not shown"). If the effect of the current setting needs
  spelling out, put it in a hint line under the box.
- Submit: an `IonButton expand="block" className="editor-form__submit"` (48px, 10px radius).
  In a modal, put it in `<EditorFooter>` (16px side and 8px vertical toolbar padding). A
  multi-step footer passes `onBack` for a 48px back square, then the primary button fills the
  rest.
- Errors: `FormField error=` renders a `.form-field__error` line.
- A secondary action beside a primary one (Cancel next to Confirm): the same 48px, 10px-radius
  button, outlined in the field-box border colour (step-200) with text-colour label; see
  `ConfirmModal`. Never a second solid button.

### Lists and rows

- Row text starts on the gutter, or on the plate/checkbox column where there is one (a 36px
  column plus 10px, so text starts at 62px).
- Rows are divided by a step-150 hairline; the last row has none.
- A whole row is the tap target for its main action; secondary controls are 36px icon buttons
  at the row's end, pulled onto the inset.
- When items belong to groups (recipes, aisles), give each group a `.ruled-label` instead of
  repeating the group name on every row.
- Ionic's `IonItem`/`IonLabel` typography outranks single classes. Either scope
  (`ion-item.my-row ion-label h3 { … }`) or build the row from plain elements with a grid.
  Plain elements are usually easier to align.

### Cards

- Frame: 14px radius, 1px step-150 border, no shadow, card surface, `overflow: hidden`.
- Body on a 12px inset (14px on top above a title).
- Meta pinned to the foot (`margin-top: auto`) so meta and footers align across a row of cards.
- Actions live in a **footer bar**, not scattered over the body: `.card-actions` with
  `.card-actions__btn` buttons (equal columns, 40px, hairlines). Icon plus a short label (`Pick`,
  `Filter`) when there are more than two actions. Disabled actions are shown at 35% opacity.

### Plates: `AislePlate`

The 36×28px "shield" route marker at the start of an aisle header: a number, a monochrome
emoji, or a widened "AISLE 3" sign. Reuse `AislePlate` wherever an aisle is shown. For other
numbered sequences (steps, slots), use a **bare lilac numeral** right-aligned in a 1.25rem
column, 12px from its text.

### Chips and pills

- Tag chips: `TagChip` with `size="sm"` (20px, lists and cards) or `size="md"` (28px, pickers).
  In pickers, a plain `<button aria-pressed>` wraps the chip; the chip draws its own on/off
  state via `selected`.
- Info pills (a time limit, "12 in pool"): 20px, 1px step-200 border, 0.75rem 600 tabular,
  medium color; warning variant tinted amber.
- Preset / sort chips: `.preset-chip` (32px, 8px radius); the chosen one `--active` or
  `aria-pressed`, an always-lilac action chip `--accent`.

### Empty, loading, and the robot

- Empty tab/page: `TabEmptyState`. Loading: `RobotLoadingContent` (the robot is branding; keep
  it).
- The robot's asides are terminal lines: mono 0.75rem in the field frame, with a lilac `>`
  prompt and a blinking cursor: `<RobotLine>` (`components/shared/RobotLine.tsx`). Pass
  `cursor={false}` for text that updates live (a countdown). Copy is deadpan-robot: dry,
  professional, faintly robotic.

### Headers and modals

- Modal header: `IonToolbar` with `IonTitle` and a close icon button with `aria-label="Close"`.
- Sticky bits that belong to the header (a step indicator, a search field) go inside
  `IonHeader`, so they stay put while the content scrolls.
- Every `IonFab` needs a `<FabSpacer />` (see `CLAUDE.md`).
- **The header holds navigation only** (title, close, an info button). Never a delete.

### Deleting

Two cases, two controls. There is no trash-can icon in the app.

1. **Deleting (or leaving) the thing the sheet is about** (an item, a recipe, an aisle, a
   store, a household): `<DestructiveAction>` ("Delete recipe", "Leave household"), a
   full-width 48px **outlined** danger button at the foot of the sheet's content, 32px below the
   form. Not in the header, where it sits next to Close; not in the footer, where it sits next
   to Save; not solid, so it never outshouts the primary action. Only shown when editing an
   existing thing. Always confirm with an alert whose destructive button repeats the verb.
2. **Removing one row from a list** (a member, an invitation, a tag, an ingredient, a queued
   change): `<RowRemoveButton label="Remove Ana">`, a quiet 36px × at the row's end, medium until
   pressed, then danger, its glyph pulled onto the row's end inset. Confirm when the removal
   can't be undone from the same screen.

Bulk destruction with character (Obliterate) keeps its own amber hazard treatment.

## 5. Accessibility

- Icon-only buttons get an `aria-label`. Decorative numerals and glyphs get `aria-hidden`.
- Toggle-like buttons use `aria-pressed`; steppers use `aria-current="step"`.
- Don't put `onClick` on a `div`. Use a `<button type="button">` (reset its styles) so it's
  focusable, and give it a `:focus-visible` outline (2px primary).
- Visually hidden text: `.sr-only`; `aria-label` on a plain span is ignored.
- Respect `prefers-reduced-motion`: turn animations off.

## 6. Checklist for restyling a screen

1. Every edge on the 16px gutter; box contents on a 12px inset; icon glyphs pulled onto the line.
2. Forms on `.editor-form` / `FormField` / `.form-control`; a submit button in the footer.
3. Group headings are `.ruled-label` (compound selector if you add margins).
4. No JetBrains Mono except counts on labels and robot lines; no px font sizes; tabular numbers.
5. Only theme tokens: no hex fallbacks, no `rgba()` of brand purple, and hairlines are step-150.
6. Cards: 14px radius, hairline, no shadow, actions in an equal-column footer bar.
7. Buttons are `<button>`s with focus rings and aria-labels; nothing clickable is a `div`.
8. Delete dead CSS classes you orphan, and don't restyle shared components in ways that break
   their other callers (grep for usages first).
