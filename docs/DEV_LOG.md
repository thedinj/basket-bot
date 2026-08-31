# Dev Log — Meals & Plan Flow Enhancement

Tracking implementation progress for the meal planning feature described in `design_handoff_basket_bot/README.md`.

---

## 2026-05-03

### ✅ Data model & backend APIs

**Migration** `20260503_100000_add_plan_tables.ts`

- Added `Plan`, `PlanSlot`, `PlanIngredientRoute` tables to SQLite schema
- Updated `init.ts` to include new tables for fresh database installs

**Core schemas** `packages/core/src/schemas/plan.ts`

- `Plan`, `PlanSlot`, `PlanIngredientRoute`, `PlanWithDetails` types
- Request schemas: `createPlan`, `updatePlan`, `updatePlanSlots`, `rerollPlan`, `updateRoutes`
- Exported from `packages/core/src/schemas/index.ts`

**Repo** `apps/backend/src/lib/repos/planRepo.ts`

- Full CRUD for plans
- `upsertSlots` — JSON `tagIds`, `ON CONFLICT` merge by `(planId, slotNumber)`
- `upsertRoutes` — `ON CONFLICT` merge by `(planId, ingredientId)`
- `setSlotPick`, `deleteExtraSlots`

**Service** `apps/backend/src/lib/services/planService.ts`

- Household membership guard on all operations
- Reroll: respects pinned slots, excludes already-picked recipes within the same batch
- Dispatch: transactional; find-or-creates `StoreItem`, upserts `ShoppingListItem`

**Plan API routes** (under `/api/households/[householdId]/`)

- `plans/` — GET list, POST create
- `plans/[planId]/` — GET (with details), PATCH, DELETE
- `plans/[planId]/slots` — PUT (replace slot config)
- `plans/[planId]/routes` — PUT (replace routing)
- `plans/[planId]/reroll` — POST `{ slots: [1, 3] }`
- `plans/[planId]/dispatch` — POST

**Recipe & tag API routes** (prerequisite for plan flow)

- `recipes/` — GET, POST
- `recipes/[recipeId]/` — GET (with details), PATCH, DELETE
- `recipes/[recipeId]/tags/` — POST assign, `[tagId]` DELETE
- `recipes/[recipeId]/ingredients/` — POST, `[ingredientId]` PATCH/DELETE
- `recipes/pool-count` — GET `?tagIds[]=...` (slot pool count for step 1)
- `tags/` — GET, POST
- `tags/[tagId]/` — PATCH, DELETE

All layers typecheck clean (`pnpm typecheck` passes across monorepo).

---

### ✅ Meals tab skeleton

- Created `apps/mobile/src/pages/Meals.tsx` — empty state with CTA
- Created `apps/mobile/src/pages/Meals.scss` — hi-fi token styling
- Updated `apps/mobile/src/components/Main.tsx`:
    - Added `meals` tab with `restaurantOutline` icon
    - Registered `/meals` route
    - Tab bar now renders (2 tabs triggers `has-tabs` body class for FAB positioning)

---

### ✅ TanStack Query data layer

**`apps/mobile/src/lib/api/meals.ts`**

- `recipeApi` — 12 methods: recipes CRUD, tag assign/remove, ingredient CRUD, pool-count
- `planApi` — 8 methods: plans CRUD, slots PUT, routes PUT, reroll POST, dispatch POST

**`apps/mobile/src/db/mealsHooks.ts`**

- 6 query hooks: `useRecipes` (suspense), `useRecipe`, `useTags`, `usePlans`, `usePlan`, `usePoolCount`
- 19 mutation hooks covering all recipe/tag/ingredient/plan operations
- `useDispatchPlan` shows success toast with item count on dispatch

---

### ✅ Recipe library & detail

**`apps/mobile/src/components/meals/TagChip.tsx`**

- Reusable chip with `getTagCategory(name)` for 6 color categories
- Uses rgba-tinted bg/border/text per hi-fi design tokens

**`apps/mobile/src/components/meals/RecipeCard.tsx`**

- Card: recipe name, description snippet, ingredient count in mono
- 16px border-radius, `--ion-card-background`, `--ion-border-color`

**`apps/mobile/src/pages/RecipeLibrary.tsx` + `.scss`**

- `IonSearchbar` + tag chip filter row (togglable)
- 2-column CSS grid of `RecipeCard`s, 16px padding, 12px gap
- Empty state, `IonFab` with `IonFabList` secondary mini-FAB (LLM import placeholder)
- `Suspense` boundary wrapping the suspense query

**`apps/mobile/src/pages/RecipeDetail.tsx` + `.scss`**

- Back button + edit button in header
- Tag chips, ingredients list (qty+unit in mono), steps, description/notes

**Routing added to `Main.tsx`:**

- `/meals/recipes/:recipeId` → `RecipeDetail`
- `/meals/recipes` → `RecipeLibrary`

**`Meals.tsx` updated** — FAB and CTA both push to `/meals/recipes`

All typecheck clean.

---

---

### ✅ Recipe create / edit

**`apps/mobile/src/pages/RecipeEditor.tsx`**

- Single component handling both create (`/meals/recipes/new`) and edit (`/meals/recipes/:recipeId/edit`) modes
- Local state for all form fields (name, description, steps, sourceUrl)
- Inline ingredient list: qty (number) + unit + name columns, per-row delete, add-row button
- Tag chip selector: all household tags shown as toggleable chips (dimmed when unselected)
- Save button in header; Delete in overflow menu (edit mode only)
- On save (create): create recipe → add all valid ingredient rows → assign all selected tags → navigate to detail
- On save (edit): update recipe → tag diff (add new, remove deselected) → ingredient diff (delete removed, add new, update changed)

**`apps/mobile/src/pages/RecipeEditor.scss`**

- Section label styling (uppercase, muted, 12px)
- Ingredient row: flex layout, JetBrains Mono for qty/unit columns, full-width name input
- Tag buttons: `opacity: 0.45` unselected → `1.0` selected with smooth transition
- `all: unset` on native `<button>` elements to avoid browser defaults in Ionic

**`apps/mobile/src/components/Main.tsx`** — routes added (most-specific first):

- `/meals/recipes/new` → `RecipeEditor`
- `/meals/recipes/:recipeId/edit` → `RecipeEditor`

## Up next

- [ ] Run migration on dev database (`pnpm db:migrate` in `apps/backend/`)
- [ ] Plan wizard — 4-step component at `/meals/plan/new?step=N`
    - Step 1: Basket (slot count + tag intent)
    - Step 2: Fill (randomizer picks, pin/reroll)
    - Step 3: Route (ingredient → store assignment)
    - Step 4: Send (review + dispatch)
- [ ] Tag management screen
- [ ] Plan-in-progress view (post-dispatch checklist)
