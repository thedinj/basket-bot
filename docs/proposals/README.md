# Shopping List Proposals

Scoped, hand-off-ready task documents for shopping-list improvements. Each doc is
self-contained: problem statement, supporting data, files to touch, design spec,
conventions that apply, and acceptance criteria.

These came out of a review of the shopping list feature (Aug 2026) plus analysis of
`apps/backend/database.db` (a copy of prod with test data added).

## Tasks

| # | Task | Status | Depends on |
| - | ---- | ------ | ---------- |
| 1 | [Location picker rewrite](./01-location-picker-rewrite.md) | Not started | — |
| 2 | [Item editor modal rearrangement](./02-item-editor-modal-rearrangement.md) | Not started | #1 |
| 3 | [Shopping list swipe actions](./03-shopping-list-swipe-actions.md) | Not started | #2 (shares `SnoozeChips`) |
| 4 | [Trip progress indicator](./04-trip-progress-indicator.md) | Not started | — |

## Shared work between tasks

Two pieces of code are created in one task and consumed by another. Check whether the
upstream task has landed before starting:

- **`SnoozeChips`** — created in **#2**, reused in **#3**. If #3 is picked up first,
  build the component at the path #2 specifies so #2 can consume it as-is.
- **`LocationPicker`** — created in **#1**, consumed by **#2**. #2 assumes the Location
  field is already a single row. If #1 has not landed, #2 should leave the two existing
  aisle/section rows in place and reorder around them.

## Conventions that apply to all of these

From [`CLAUDE.md`](../../CLAUDE.md) and `.github/copilot-instructions.md`:

- **Prettier**: 4-space indent, 100-char lines, **no semicolons**, trailing commas.
- **Components**: `const MyComponent: React.FC<Props> = () => {}` — arrow functions,
  never `function` declarations. PascalCase filenames for components, camelCase for
  hooks/utilities.
- **Types**: no ad-hoc `interface` declarations for domain data — derive from Zod schemas
  in `packages/core`. No one-off inline object types in casts.
- **UI**: Ionic components for all interactive mobile UI.
- **Query keys**: always build via the `queryKeys` factory in
  [`apps/mobile/src/db/queryKeys.ts`](../../apps/mobile/src/db/queryKeys.ts). Never
  hand-write a raw key array.
- **Cache invalidation**: every mutation must invalidate the exact key of *every* query
  surfacing the changed data. See
  [`apps/mobile/docs/CACHE_KEYS.md`](../../apps/mobile/docs/CACHE_KEYS.md) and keep it
  updated in the same change.
- **Mutation errors**: never add a per-hook `onError` toast. Pass
  `meta: { operation: "short description" }` and let the global `MutationCache.onError`
  in `DatabaseContext.tsx` handle it. Use `markErrorHandled(error)` only when a mutation
  must react to a specific error itself.
- **FABs**: every page/modal rendering an `IonFab` must render `<FabSpacer />` as the last
  child inside `IonContent`, unconditionally.
- **Verification**: `pnpm typecheck && pnpm lint && pnpm build` from the repo root. Do not
  use browser automation to validate UI changes unless asked.

## Data snapshot used by these docs

From `apps/backend/database.db` as of 2026-08-19. Re-run the queries in each doc if the
numbers matter to a decision you are revisiting.

- 3 users, 8 stores, 545 store items, 35 active shopping list items, 63 aisles,
  246 sections, 61 recipes / 726 recipe ingredients.
- Store structure is wildly uneven — Festival (Verona) has 22 aisles / 229 sections;
  four of eight stores have **zero** aisles and sections.
- Of 35 list items, 22 were added from recipes and 13 manually.
- On **manually** added items: `qty` 15%, `unitId` 15%, `notes` 23%, `isUnsure` 8%,
  `isPrivate` 8%, `snoozedUntil` 0%.
- Only 8 of 34 list items have an aisle; 3 have a section.

## Explicitly out of scope

Considered and declined during scoping — do not add these without a new discussion:

- Merging duplicate list rows on add (different units/notes make it lossy; separate rows
  are intentional).
- Purchase history / pantry inventory / price tracking.
- Real-time sync, SSE, presence indicators (current refresh rate is fine in practice).
- Barcode scanning (~60% of the main store's catalog is produce/meat/deli/bakery with no
  usable global UPC).
- Item emoji/icons and a "regulars" quick-add strip (deferred, not rejected).
- Batching the LLM auto-categorize calls (quality risk with low-cost models).
