# Cache Key Encyclopedia (Mobile / TanStack Query)

Single source of truth for every TanStack Query cache in the mobile app: what each key
holds, which hook owns it, and **which mutations must cascade into it**. Stale-data bugs
happen when a mutation changes data but fails to invalidate a query that displays that
data — this document exists so the cascade is auditable rather than guessed.

> **Query keys are an exact vocabulary.** `invalidateQueries({ queryKey: K })` only
> refreshes a query when `K` is a **prefix** of that query's key (element-by-element,
> shallow-equal). A typo or wrong casing (`["shoppingListItems"]` vs
> `["shopping-list-items"]`, `["store", id]` vs `["stores", id]`) silently no-ops.
> Always use the exact keys below.

## How to keep this file up to date

When you touch caching, update this file **in the same change**:

1. **Add a query hook** → add a row to [§1 Cache registry](#1-cache-registry).
2. **Add/change a mutation** → update its row in [§2 Mutation cascade table](#2-mutation-cascade-table)
   **and** the reverse index in [§3 Invalidated-by index](#3-invalidated-by-index).
3. **Rule of thumb:** a mutation must invalidate the key of *every* cache in §1 whose
   "Contains" column includes data the mutation can change — not just the obvious one.
   Use §1's "Joins / derived from" column to find the non-obvious ones.

Keys live in `src/db/hooks.ts` (stores/items/shopping-list/households), `src/db/mealsHooks.ts`
(recipes/plans/tags), and a few local hooks (`usePreference`, `useSecureStorage`, `useAuthMutations`).

---

## 1. Cache registry

### Store domain (`db/hooks.ts`)

| Key | Contains | Owner hook | Joins / derived from | Stale time |
|---|---|---|---|---|
| `["stores"]` | All of the user's stores (list) | `useStores` (suspense) | — | prefetched 30 min |
| `["stores", storeId]` | One store's detail | `useStore`, `useStoreSuspense` | — | default (2 min) |
| `["quantityUnits"]` | Static unit reference data | `useQuantityUnits` | — | **Infinity** |
| `["appSettings", key]` | One app setting value | `useAppSetting` | — | 5 min |

### Store layout (`db/hooks.ts`)

| Key | Contains | Owner hook | Joins / derived from | Stale time |
|---|---|---|---|---|
| `["aisles", storeId]` | Aisles for a store (ordered) | `useStoreAisles` | — | prefetched 30 min |
| `["aisles", "detail", id]` | *(reserved — no reader yet)* | — | — | — |
| `["sections", storeId]` | Sections for a store (ordered) | `useStoreSections` | belongs to an aisle | prefetched 30 min |
| `["sections", "detail", id]` | One section's detail | `useSection` | aisle | default |

### Store items (`db/hooks.ts`)

| Key | Contains | Owner hook | Joins / derived from | Stale time |
|---|---|---|---|---|
| `["items", storeId]` | Store items, names only (sorted) | `useStoreItems` | — | default |
| `["items", "with-details", storeId]` | Store items **joined with aisle+section names** | `useStoreItemsWithDetails` | `aisles`, `sections` | default |
| `["items", "detail", id]` | One store item's detail | `useItem` | — | default |
| `["store-items", "search", storeId, term]` | Autocomplete search results | `useStoreItemAutocomplete` | store items | 30 s |

### Shopping list (`db/hooks.ts`)

| Key | Contains | Owner hook | Joins / derived from | Stale time |
|---|---|---|---|---|
| `["shopping-list-items", storeId]` | Shopping-list items, **joined with store-item + aisle/section names, ordered by aisle/section** | `useShoppingListItems` (suspense) | `items`, `aisles`, `sections` | default |

### Recipes & meal planning (`db/mealsHooks.ts`)

| Key | Contains | Owner hook | Joins / derived from | Stale time |
|---|---|---|---|---|
| `["recipes", householdId]` | Recipe **list — full `RecipeWithDetails`, including ingredients + tags** | `useRecipes` (suspense) | ingredients, tags | 2 min |
| `["recipes", householdId, recipeId]` | One recipe's detail (ingredients + tags) | `useRecipe` | ingredients, tags | default |
| `["tags", householdId]` | Household recipe tags | `useTags` | — | 5 min |
| `["plans", householdId]` | Meal plans (list) | `usePlans` | — | 1 min |
| `["plans", householdId, planId]` | One plan (slots + routes) | `usePlan` | recipes, ingredients | 30 s |
| `["pool-count", householdId, tagIds, maxCookingTimeMinutes]` | Count of eligible recipes for slot filters | `usePoolCount` | recipes, tags | 30 s |
| `["plans-history", householdId]` | Paged dispatched-plan history | `usePlansHistory` (infinite) | — | 1 min |

### Households & sharing (`db/hooks.ts`)

| Key | Contains | Owner hook | Stale time |
|---|---|---|---|
| `["households"]` | Households the user belongs to | `useHouseholds` | 2 min |
| `["household", householdId]` | Household detail + members | `useHouseholdDetail` | 2 min |
| `["household", householdId, "invitations"]` | Pending invites for a household | `useHouseholdInvitations` | 2 min |
| `["invitations"]` | Invites addressed to the current user | `usePendingInvitations` | 2 min |
| `["notifications", "counts"]` | Notification badge counts | `useNotificationCounts` | 5 min |

### Auth & local device state

| Key | Contains | Owner hook | Notes |
|---|---|---|---|
| `["auth", "me"]` | Current authenticated user | `useAuthUser` | 5 min |
| `["auth", "invitation-required"]` | Whether registration needs an invite | `Register.tsx` | — |
| `["preference", key]` | A Capacitor Preferences value | `usePreference` (suspense) | updated via `setQueryData` |
| `["secure-storage", key]` | A secure-storage value | `useSecureValue` (read) / `useSaveSecureValue` (write) | — |

---

## 2. Mutation cascade table

Each mutation must invalidate every cache whose data it changes. `*` means the **broad
prefix** (no `storeId`/`householdId`), which matches that key for **all** stores/households —
use it when the mutation can affect more than one, or the set is unknown.

### Store / layout mutations (`db/hooks.ts`)

| Mutation | Writes | Invalidates |
|---|---|---|
| `useCreateStore` | store | `["stores"]` |
| `useUpdateStore` | store | `["stores"]`, `["stores", id]` |
| `useDeleteStore` | store | `["stores"]` |
| `useDuplicateStore` | store (+layout/items) | `["stores"]` |
| `useUpdateStoreHousehold` | store sharing | `["stores", storeId]`, `["stores"]` |
| `useUpdateStoreVisibility` | store hidden flag | `["stores", storeId]`, `["stores"]` |
| `useSaveAppSetting` | app setting | `["appSettings", key]` |
| `useCreateAisle` | aisle | `["aisles", storeId]` |
| `useUpdateAisle` | aisle name | `["aisles", storeId]`, `["aisles","detail",id]`, `["items", storeId]`, `["items","with-details",storeId]`, `["shopping-list-items", storeId]` |
| `useDeleteAisle` | aisle | `["aisles", storeId]`, `["items","with-details",storeId]`, `["shopping-list-items", storeId]` |
| `useReorderAisles` | aisle order | `["aisles", storeId]`, `["shopping-list-items", storeId]` |
| `useCreateSection` | section | `["sections", storeId]` |
| `useUpdateSection` | section name/aisle | `["sections", storeId]`, `["sections","detail",id]`, `["items","with-details",storeId]`, `["shopping-list-items", storeId]` |
| `useDeleteSection` | section | `["sections", storeId]`, `["items","with-details",storeId]`, `["shopping-list-items", storeId]` |
| `useMoveSection` | section aisle + order | `["sections", storeId]`, `["items","with-details",storeId]`, `["shopping-list-items", storeId]` |
| `useReorderSections` | section order | `["sections", storeId]`, `["shopping-list-items", storeId]` |
| `useBulkApplyAislesAndSections` | aisles + sections (bulk) | `["aisles", storeId]`, `["sections", storeId]` |

### Store-item mutations (`db/hooks.ts`)

| Mutation | Writes | Invalidates |
|---|---|---|
| `useCreateItem` | store item | `["items", storeId]`, `["items","with-details",storeId]` |
| `useUpdateItem` | store item name/location | `["items", storeId]`, `["items","with-details",storeId]`, `["items","detail",id]`, `["shopping-list-items", storeId]` |
| `useGetOrCreateStoreItem` | store item (maybe new) | `["items", storeId]`, `["items","with-details",storeId]` |
| `useDeleteItem` | store item (+its list item) | `["items", storeId]`, `["items","with-details",storeId]`, `["shopping-list-items", storeId]` |
| `useToggleFavorite` | favorite flag (optimistic) | `["items", storeId]`, `["items","with-details",storeId]`, `["items","detail",id]` |

### Shopping-list mutations (`db/hooks.ts` + components)

| Mutation | Writes | Invalidates |
|---|---|---|
| `useUpsertShoppingListItem` | list item (may create store item) | `["shopping-list-items", storeId]`, `["items", storeId]`, `["items","with-details",storeId]`, `["store-items","search",storeId]` |
| `useToggleItemChecked` | checked flag (optimistic) | `["shopping-list-items", storeId]` |
| `useDeleteShoppingListItem` | list item (+store item) | `["shopping-list-items", storeId]` |
| `useRemoveShoppingListItem` | list item only | `["shopping-list-items", storeId]` |
| `useClearCheckedItems` | list items (optimistic) | `["shopping-list-items", storeId]` |
| `useMoveItemToStore` | list item + target store item | `["shopping-list-items", sourceStoreId]`, `["shopping-list-items", targetStoreId]`, `["items", targetStoreId]`, `["items","with-details",targetStoreId]` |
| `useBulkImport` (`components/shoppinglist`) | many list/store items | `["shopping-list-items", storeId]` (+ per-item via `useUpsert…`/`useGetOrCreate…`) |
| `GroupedShoppingList` auto-categorize | item categories | `["shopping-list-items", storeId]`, `["items", storeId]`, `["items","with-details",storeId]` |

### Recipe / ingredient / tag / plan mutations (`db/mealsHooks.ts`)

| Mutation | Writes | Invalidates |
|---|---|---|
| `useCreateRecipe` | recipe | `["recipes", householdId]` |
| `useUpdateRecipe` | recipe fields | `["recipes", householdId]`, `["recipes", householdId, recipeId]` |
| `useDeleteRecipe` | recipe | `["recipes", householdId]` |
| `useAddIngredient` | ingredient | `["recipes", householdId, recipeId]`, `["recipes", householdId]` |
| `useUpdateIngredient` | ingredient | `["recipes", householdId, recipeId]`, `["recipes", householdId]` |
| `useDeleteIngredient` | ingredient | `["recipes", householdId, recipeId]`, `["recipes", householdId]` |
| `useAssignTag` / `useRemoveTag` | recipe↔tag link | `["recipes", householdId]`, `["recipes", householdId, recipeId]` |
| `useCreateTag` | tag | `["tags", householdId]` |
| `useUpdateTag` / `useDeleteTag` | tag | `["tags", householdId]`, `["recipes", householdId]` |
| `useAddRecipeToShoppingList` | list + store items (multi-store) | `["shopping-list-items"]`\*, `["items"]`\* |
| `useCreatePlan` / `useDeletePlan` | plan | `["plans", householdId]` |
| `useUpdatePlan` | plan | `["plans", householdId, planId]`, `["plans", householdId]` |
| `useUpdatePlanSlots` / `useUpdatePlanRoutes` / `useRerollSlots` | plan slots/routes | `["plans", householdId, planId]` |
| `useDispatchPlan` | plan + shopping list | `["plans", householdId]`, `["plans", householdId, planId]` |

### Household / invitation mutations (`db/hooks.ts`)

| Mutation | Invalidates |
|---|---|
| `useCreateHousehold` | `["households"]` |
| `useUpdateHousehold` | `["household", id]`, `["households"]` |
| `useDeleteHousehold` | `["household", id]`, `["households"]`, `["stores"]` |
| `useInviteMember` | `["household", householdId]` |
| `useRemoveMember` | `["household", householdId]`, `["households"]`, `["stores"]` |
| `useAcceptInvitation` | `["invitations"]`, `["households"]` |
| `useDeclineInvitation` | `["invitations"]` |
| `useCancelInvitation` | `["household", householdId, "invitations"]` |

### Cross-cutting / lifecycle

| Operation | Effect |
|---|---|
| `useLoginMutation` | `invalidateQueries()` (all) + `removeQueries(["shopping-list-items"])` |
| `useLogoutMutation` | `invalidateQueries()` then `queryClient.clear()` (wipe all) |
| `useSaveAppSetting` / `usePreference` | `usePreference` writes via `setQueryData(["preference", key])` |
| `checkAndInvalidateCoreDataCache` / `forceClearCoreDataCache` | `["quantityUnits"]`, `["appSettings"]` (on app-version bump) |
| `RefreshConfig.refresh(keys?)` / pull-to-refresh | invalidates the passed keys, or all queries if none |

---

## 3. Invalidated-by index

Reverse lookup: "if I change X, who refreshes it?" When you add a mutation that writes to
one of these caches, add it here too.

| Cache key | Invalidated by |
|---|---|
| `["stores"]` | create/update/delete/duplicate store, update household/visibility, delete household, remove member |
| `["stores", storeId]` | `useUpdateStore`, `useUpdateStoreHousehold`, `useUpdateStoreVisibility` |
| `["aisles", storeId]` | create/update/delete/reorder aisle, `useBulkApplyAislesAndSections` (**not** `useMoveSection` — aisle rows are unchanged when a section moves) |
| `["sections", storeId]` | create/update/delete/reorder/move section, `useBulkApplyAislesAndSections` |
| `["items", storeId]` | create/update/get-or-create/delete item, toggle favorite, **`useUpdateAisle`** (plain list only — *not* delete aisle), move-item-to-store (target), upsert list item, bulk import, auto-categorize, **add-recipe-to-list** (`["items"]`\*) |
| `["items", "with-details", storeId]` | create/update/get-or-create/delete item, toggle favorite, update/delete aisle, update/delete/move section, upsert list item, move-item-to-store (target), auto-categorize, **add-recipe-to-list** (`["items"]`\*) |
| `["items", "detail", id]` | `useUpdateItem`, `useToggleFavorite` |
| `["store-items", "search", storeId, …]` | `useUpsertShoppingListItem` |
| `["shopping-list-items", storeId]` | upsert/toggle/delete/remove/clear/move list item, update/delete aisle, update/delete/move/reorder section, reorder aisle, **`useUpdateItem`**, **`useDeleteItem`**, bulk import, auto-categorize, **`useAddRecipeToShoppingList`** (`["shopping-list-items"]`\*) |
| `["recipes", householdId]` | create/update/delete recipe, **add/update/delete ingredient**, assign/remove tag, update/delete tag |
| `["recipes", householdId, recipeId]` | update recipe, add/update/delete ingredient, assign/remove tag |
| `["tags", householdId]` | create/update/delete tag |
| `["plans", householdId]` | create/update/delete/dispatch plan |
| `["plans", householdId, planId]` | update plan/slots/routes, reroll, dispatch |
| `["households"]` | create/update/delete household, remove member, accept invitation |
| `["household", householdId]` | update/delete household, invite/remove member |
| `["household", householdId, "invitations"]` | `useCancelInvitation` |
| `["invitations"]` | accept/decline invitation |
| `["quantityUnits"]`, `["appSettings"]` | app-version bump (`coreDataVersion`) |

---

## 4. Known non-obvious cascades (do not remove)

These are the joins that make "obvious" invalidation insufficient:

- **`["shopping-list-items", storeId]` joins store-item + aisle/section data**, so it must
  be invalidated by store-item edits (`useUpdateItem`), aisle/section edits, and reorders —
  not only by shopping-list mutations.
- **`["items", "with-details", storeId]` joins aisle/section names**, so aisle/section
  edits must invalidate it.
- **`["recipes", householdId]` (list) carries full ingredient details** and drives the
  add-to-shopping-list flow in `Meals.tsx`. Ingredient mutations must invalidate the list,
  not just the recipe detail — otherwise the cart is built from stale ingredients.
- **Ops that create a store item** (`getOrCreateStoreItemByName`, upsert, move-to-store,
  add-recipe-to-list) must invalidate both `["items", storeId]` **and**
  `["items", "with-details", storeId]`.

## 5. Prefer fresh reads over snapshots

Passing a whole `RecipeWithDetails` / `StoreItem` object into `useState` defeats
invalidation — the snapshot won't update when its cache is invalidated. Hold an **id** and
read via the query hook so the component re-renders with fresh data after a cascade.
