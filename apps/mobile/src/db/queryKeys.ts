/**
 * Centralized TanStack Query cache-key factory for the mobile app.
 *
 * **This is the single source of truth for every query key.** Query keys are an exact
 * vocabulary: `invalidateQueries({ queryKey: K })` only refreshes a query when `K` is a
 * prefix of that query's key (element-by-element, shallow-equal). A typo or wrong casing
 * (`["shoppingListItems"]` vs `["shopping-list-items"]`) silently no-ops and produces a
 * stale-data bug. Building every key through this factory makes typos a compile error.
 *
 * **Required standard:** never hand-write a `queryKey` string array. Every `useQuery`,
 * `useSuspenseQuery`, `useInfiniteQuery`, `invalidateQueries`, `removeQueries`,
 * `setQueryData`, `getQueryData`, `cancelQueries`, `refetchQueries`, `prefetchQuery`, and
 * every `RefreshConfig queryKeys` / `refresh([...])` call must build its key(s) by calling
 * a function on this object.
 *
 * **Prefix invalidation:** builders that take an id also expose a broader form (e.g.
 * `queryKeys.items.all()` → `["items"]`, which matches `["items", storeId]` and
 * `["items", "with-details", storeId]` for every store) so a mutation can invalidate a
 * whole namespace at once.
 *
 * Keys are intentionally plain (non-`readonly`) arrays so they stay assignable to the mutable
 * `RefreshQueryKey[]` refresh helpers and the `unknown[]` optimistic-update config. Household-
 * scoped keys carry a `string | null` id, since the household is null while it loads.
 *
 * See `apps/mobile/docs/CACHE_KEYS.md` for the full registry + mutation cascade tables.
 * When you add or change a key here, update that document in the same change.
 */

// Meal-planning / household ids can be null while the entity is still loading; the key
// still needs to be well-formed so the query stays disabled rather than throwing.
type Id = string;
type NullableId = string | null;

export const queryKeys = {
    // --- Auth & local device state ---
    auth: {
        me: () => ["auth", "me"],
        invitationRequired: () => ["auth", "invitation-required"],
    },
    preference: (key: string) => ["preference", key],
    secureStorage: (key: string) => ["secure-storage", key],
    /** Server-served LLM model catalogue. Read-only — nothing in the app mutates it. */
    llmCatalog: () => ["llm-catalog"],

    // --- Store domain ---
    stores: {
        all: () => ["stores"],
        detail: (storeId: Id) => ["stores", storeId],
    },
    /** Server-owned catalog of starting layouts; static per deploy, never invalidated. */
    storeTemplates: () => ["store-templates"],
    quantityUnits: () => ["quantityUnits"],
    appSettings: {
        all: () => ["appSettings"],
        detail: (key: string) => ["appSettings", key],
    },

    // --- Store layout ---
    aisles: {
        byStore: (storeId: Id) => ["aisles", storeId],
        detail: (id: Id) => ["aisles", "detail", id],
    },
    sections: {
        byStore: (storeId: Id) => ["sections", storeId],
        detail: (id: Id) => ["sections", "detail", id],
    },

    // --- Store items ---
    items: {
        /** Broad prefix — matches every `items` key (all stores, all shapes). */
        all: () => ["items"],
        byStore: (storeId: Id) => ["items", storeId],
        withDetails: (storeId: Id) => ["items", "with-details", storeId],
        detail: (id: Id) => ["items", "detail", id],
    },
    storeItemSearch: {
        /** Prefix for a store's autocomplete searches (invalidates every search term). */
        byStore: (storeId: Id) => ["store-items", "search", storeId],
        forTerm: (storeId: Id, term: string) => ["store-items", "search", storeId, term],
    },

    // --- Shopping list ---
    shoppingListItems: {
        /** Broad prefix — matches the shopping list for every store. */
        all: () => ["shopping-list-items"],
        byStore: (storeId: Id) => ["shopping-list-items", storeId],
    },

    // --- Recipes & meal planning ---
    recipes: {
        byHousehold: (householdId: NullableId) => ["recipes", householdId],
        detail: (householdId: NullableId, recipeId: NullableId) => [
            "recipes",
            householdId,
            recipeId,
        ],
    },
    tags: (householdId: NullableId) => ["tags", householdId],
    plans: {
        byHousehold: (householdId: NullableId) => ["plans", householdId],
        detail: (householdId: NullableId, planId: NullableId) => ["plans", householdId, planId],
    },
    poolCount: (
        householdId: NullableId,
        tagIds: string[],
        maxCookingTimeMinutes: number | null
    ) => ["pool-count", householdId, tagIds, maxCookingTimeMinutes],
    plansHistory: (householdId: NullableId) => ["plans-history", householdId],

    // --- Households & sharing ---
    households: () => ["households"],
    household: {
        detail: (householdId: NullableId) => ["household", householdId],
        invitations: (householdId: NullableId) => ["household", householdId, "invitations"],
    },
    invitations: () => ["invitations"],
    notificationCounts: () => ["notifications", "counts"],
};
