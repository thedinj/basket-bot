import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureHarness, harness } from "./testSupport/hookHarness";
import { queryKeys } from "./queryKeys";

/**
 * Makes `docs/CACHE_KEYS.md` §2 executable.
 *
 * Stale-data bugs are this codebase's most frequent defect: `db/hooks.ts` was the single most
 * churned file in the repo, and three separate commits exist purely to fix refreshing. The
 * cascade rules were written down in prose to stop that, but prose cannot fail a build. This
 * suite asserts the documented cascade for every mutation hook, and — via the coverage guard at
 * the bottom — fails when a new mutation hook appears without one.
 *
 * The expectations are a typed table built from the `queryKeys` factory rather than a parse of
 * the markdown. That is deliberate: the table cells are prose (`["items"]*`,
 * `(+ per-item via useUpsert…)`, free variables like `id`), so a parser would be a second
 * program with its own bugs. Building keys through the factory buys the property the doc asks
 * for in §0 — a mistyped key is a compile error.
 */

// The bindings a mutation hook touches. Replacing just these lets the hook be called as a plain
// function: no renderer, no DOM. `importOriginal` keeps the real QueryClient/MutationCache.
vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-query")>();
    const { harness: h } = await import("./testSupport/hookHarness");
    return {
        ...actual,
        useQueryClient: () => h.client,
        useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
        useSuspenseQuery: () => ({ data: undefined }),
        useMutation: (options: never) => h.register(options),
    };
});

vi.mock("./hooksShared", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./hooksShared")>();
    const { harness: h } = await import("./testSupport/hookHarness");
    return { ...actual, useDatabase: () => h.database };
});

vi.mock("../hooks/useToast", () => ({
    useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showToast: vi.fn() }),
}));

vi.mock("../components/shield/useShield", () => ({
    useShield: () => ({ raiseShield: vi.fn(), lowerShield: vi.fn() }),
}));

// Context hooks the mutation hooks reach for. Without these, React's dispatcher is null outside
// a renderer and the hook throws on `useContext`/`useRef`.
vi.mock("../hooks/refresh/useRefreshContext", () => ({
    useRefreshContext: () => ({
        refresh: vi.fn(),
        registerConfig: vi.fn(),
        unregisterConfig: vi.fn(),
    }),
}));

vi.mock("@ionic/react", () => ({
    useIonAlert: () => [vi.fn(), vi.fn()],
}));

// The household/sharing hooks call HTTP directly rather than going through `useDatabase`, so
// these API modules are the database double for them. Listed explicitly rather than proxied:
// returning a Proxy as a module namespace crashes the vite-node worker outright.
// `useUpdateHousehold` and friends key their invalidation off the *response*, not the input, so
// this stub must echo the household id the table asserts on. The literal is repeated because a
// hoisted `vi.mock` factory cannot reference module-level consts.
vi.mock("../lib/api/household", () => ({
    householdApi: {
        createHousehold: vi.fn().mockResolvedValue({ id: "household-1" }),
        updateHousehold: vi.fn().mockResolvedValue({ id: "household-1" }),
        deleteHousehold: vi.fn().mockResolvedValue({ id: "household-1" }),
        createInvitation: vi.fn().mockResolvedValue({ id: "stub-id" }),
        cancelInvitation: vi.fn().mockResolvedValue({ id: "stub-id" }),
        removeMember: vi.fn().mockResolvedValue({ id: "stub-id" }),
        getHouseholdInvitations: vi.fn().mockResolvedValue({ id: "stub-id" }),
        getHouseholdWithMembers: vi.fn().mockResolvedValue({ id: "stub-id" }),
        getUserHouseholds: vi.fn().mockResolvedValue({ id: "stub-id" }),
    },
    invitationApi: {
        acceptInvitation: vi.fn().mockResolvedValue({ id: "stub-id" }),
        declineInvitation: vi.fn().mockResolvedValue({ id: "stub-id" }),
        getUserPendingInvitations: vi.fn().mockResolvedValue({ id: "stub-id" }),
    },
}));

vi.mock("../lib/api/storeSharing", () => ({
    getNotificationCounts: vi.fn().mockResolvedValue({ id: "stub-id" }),
    updateStoreHousehold: vi.fn().mockResolvedValue({ id: "stub-id" }),
    updateStoreVisibility: vi.fn().mockResolvedValue({ id: "stub-id" }),
}));

// The mock spreads `...actual`, so this is the genuine QueryClient class. Handing it to the
// harness keeps the harness free of a static react-query import (see its module docs).
import { QueryClient } from "@tanstack/react-query";
configureHarness(QueryClient);

import * as aisleHooks from "./aisleHooks";
import * as householdHooks from "./householdHooks";
import * as invitationHooks from "./invitationHooks";
import * as itemHooks from "./itemHooks";
import * as sectionHooks from "./sectionHooks";
import * as shoppingListHooks from "./shoppingListHooks";
import * as storeHooks from "./storeHooks";

const STORE = "store-1";
const TARGET_STORE = "store-2";
const AISLE = "aisle-1";
const SECTION = "section-1";
const ITEM = "item-1";
const LIST_ITEM = "list-item-1";
const HOUSEHOLD = "household-1";
const INVITATION = "invitation-1";

/**
 * Every hook has its own concrete variables type, so the table is heterogeneous by nature. A
 * `never` parameter is what lets one array hold all of them: it is assignable to each hook's real
 * parameter type, and the call site widens it back once.
 */
type AnyMutationHook = () => { mutateAsync: (variables: never) => Promise<unknown> };

interface Cascade {
    name: string;
    hook: AnyMutationHook;
    vars: unknown;
    invalidates: unknown[][];
    /** Set when the hook resolves its database call into something a callback reads. */
    stub?: [method: string, value: unknown];
}

const CASCADES: Cascade[] = [
    // --- Store / layout ---
    {
        // A templated store arrives with a layout already in it, so creation must also drop
        // any prefetched (empty) aisle/section cache for the new id.
        name: "useCreateStore",
        hook: storeHooks.useCreateStore,
        vars: { name: "New Store", templateId: "grocery" },
        stub: ["insertStore", { id: STORE }],
        invalidates: [
            queryKeys.stores.all(),
            queryKeys.aisles.byStore(STORE),
            queryKeys.sections.byStore(STORE),
        ],
    },
    {
        name: "useUpdateStore",
        hook: storeHooks.useUpdateStore,
        vars: { id: STORE, name: "Renamed" },
        invalidates: [queryKeys.stores.all(), queryKeys.stores.detail(STORE)],
    },
    {
        name: "useDeleteStore",
        hook: storeHooks.useDeleteStore,
        vars: { id: STORE },
        invalidates: [queryKeys.stores.all()],
    },
    {
        name: "useDuplicateStore",
        hook: storeHooks.useDuplicateStore,
        vars: { storeId: STORE, name: "Copy" },
        invalidates: [queryKeys.stores.all()],
    },
    {
        name: "useReorderStores",
        hook: storeHooks.useReorderStores,
        vars: { storeIds: [STORE, TARGET_STORE] },
        invalidates: [queryKeys.stores.all()],
    },
    {
        name: "useSaveAppSetting",
        hook: storeHooks.useSaveAppSetting,
        vars: { key: "theme", value: "dark" },
        invalidates: [queryKeys.appSettings.detail("theme")],
    },
    {
        name: "useCreateAisle",
        hook: aisleHooks.useCreateAisle,
        vars: { storeId: STORE, name: "Produce" },
        invalidates: [queryKeys.aisles.byStore(STORE)],
    },
    {
        // §4 non-obvious cascade: aisle names are denormalized onto items and list rows, so a
        // rename has to reach the shopping list or the old name stays on screen.
        name: "useUpdateAisle",
        hook: aisleHooks.useUpdateAisle,
        vars: { storeId: STORE, id: AISLE, name: "Produce" },
        invalidates: [
            queryKeys.aisles.byStore(STORE),
            queryKeys.aisles.detail(AISLE),
            queryKeys.items.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useDeleteAisle",
        hook: aisleHooks.useDeleteAisle,
        vars: { storeId: STORE, id: AISLE },
        invalidates: [
            queryKeys.aisles.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useReorderAisles",
        hook: aisleHooks.useReorderAisles,
        vars: { storeId: STORE, aisleIds: [AISLE] },
        invalidates: [queryKeys.aisles.byStore(STORE), queryKeys.shoppingListItems.byStore(STORE)],
    },
    {
        name: "useCreateSection",
        hook: sectionHooks.useCreateSection,
        vars: { storeId: STORE, aisleId: AISLE, name: "Fruit" },
        invalidates: [queryKeys.sections.byStore(STORE)],
    },
    {
        name: "useUpdateSection",
        hook: sectionHooks.useUpdateSection,
        vars: { storeId: STORE, id: SECTION, name: "Fruit" },
        invalidates: [
            queryKeys.sections.byStore(STORE),
            queryKeys.sections.detail(SECTION),
            queryKeys.items.withDetails(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useDeleteSection",
        hook: sectionHooks.useDeleteSection,
        vars: { storeId: STORE, id: SECTION },
        invalidates: [
            queryKeys.sections.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useMoveSection",
        hook: sectionHooks.useMoveSection,
        vars: {
            storeId: STORE,
            sectionId: SECTION,
            newAisleId: AISLE,
            newSortOrder: 0,
            sourceSections: [{ id: SECTION, sortOrder: 0 }],
            destSections: [{ id: SECTION, sortOrder: 0 }],
            sectionName: "Fruit",
        },
        invalidates: [
            queryKeys.sections.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useReorderSections",
        hook: sectionHooks.useReorderSections,
        vars: { storeId: STORE, sectionIds: [SECTION] },
        invalidates: [
            queryKeys.sections.byStore(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },

    // --- Store items ---
    {
        // §4: anything that can create a store item must hit both item caches — the plain list
        // and the with-details list are separate keys and both feed pickers.
        name: "useCreateItem",
        hook: itemHooks.useCreateItem,
        vars: { storeId: STORE, name: "Apples" },
        invalidates: [queryKeys.items.byStore(STORE), queryKeys.items.withDetails(STORE)],
    },
    {
        name: "useUpdateItem",
        hook: itemHooks.useUpdateItem,
        vars: { storeId: STORE, id: ITEM, name: "Apples" },
        invalidates: [
            queryKeys.items.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.items.detail(ITEM),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useGetOrCreateStoreItem",
        hook: itemHooks.useGetOrCreateStoreItem,
        vars: { storeId: STORE, name: "Apples" },
        invalidates: [queryKeys.items.byStore(STORE), queryKeys.items.withDetails(STORE)],
    },
    {
        name: "useDeleteItem",
        hook: itemHooks.useDeleteItem,
        vars: { storeId: STORE, id: ITEM },
        invalidates: [
            queryKeys.items.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.shoppingListItems.byStore(STORE),
        ],
    },
    {
        name: "useToggleFavorite",
        hook: itemHooks.useToggleFavorite,
        vars: { storeId: STORE, id: ITEM },
        invalidates: [
            queryKeys.items.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.items.detail(ITEM),
        ],
    },

    // --- Shopping list ---
    {
        name: "useUpsertShoppingListItem",
        hook: shoppingListHooks.useUpsertShoppingListItem,
        vars: { storeId: STORE, id: LIST_ITEM, storeItemId: ITEM },
        invalidates: [
            queryKeys.shoppingListItems.byStore(STORE),
            queryKeys.items.byStore(STORE),
            queryKeys.items.withDetails(STORE),
            queryKeys.storeItemSearch.byStore(STORE),
        ],
    },
    {
        name: "useToggleItemChecked",
        hook: shoppingListHooks.useToggleItemChecked,
        vars: { storeId: STORE, id: LIST_ITEM, isChecked: true },
        invalidates: [queryKeys.shoppingListItems.byStore(STORE)],
    },
    {
        name: "useSwipeUpdateShoppingListItem",
        // Takes the operation name (used for the error-toast wording) as a factory argument.
        hook: () => shoppingListHooks.useSwipeUpdateShoppingListItem("snooze item"),
        vars: { storeId: STORE, id: LIST_ITEM, isUnsure: true },
        invalidates: [queryKeys.shoppingListItems.byStore(STORE)],
    },
    {
        name: "useDeleteShoppingListItem",
        hook: shoppingListHooks.useDeleteShoppingListItem,
        vars: { storeId: STORE, id: LIST_ITEM },
        invalidates: [queryKeys.shoppingListItems.byStore(STORE)],
    },
    {
        name: "useRemoveShoppingListItem",
        hook: shoppingListHooks.useRemoveShoppingListItem,
        vars: { storeId: STORE, id: LIST_ITEM },
        invalidates: [queryKeys.shoppingListItems.byStore(STORE)],
    },
    {
        name: "useClearCheckedItems",
        hook: shoppingListHooks.useClearCheckedItems,
        vars: { storeId: STORE },
        invalidates: [queryKeys.shoppingListItems.byStore(STORE)],
    },
    {
        // Both stores' lists must refresh, and the destination's item caches too, since the move
        // can create a store item there.
        name: "useMoveItemToStore",
        hook: shoppingListHooks.useMoveItemToStore,
        vars: {
            item: {
                id: LIST_ITEM,
                itemName: "Apples",
                notes: null,
                qty: 2,
                unitId: null,
                isIdea: false,
                isSample: null,
                isUnsure: null,
                isPrivate: null,
                snoozedUntil: null,
            },
            sourceStoreId: STORE,
            targetStoreId: TARGET_STORE,
            targetStoreName: "Other Store",
        },
        invalidates: [
            queryKeys.shoppingListItems.byStore(STORE),
            queryKeys.shoppingListItems.byStore(TARGET_STORE),
            queryKeys.items.byStore(TARGET_STORE),
            queryKeys.items.withDetails(TARGET_STORE),
        ],
    },

    // --- Households & sharing ---
    {
        name: "useCreateHousehold",
        hook: householdHooks.useCreateHousehold,
        vars: { name: "Home" },
        invalidates: [queryKeys.households()],
    },
    {
        name: "useUpdateHousehold",
        hook: householdHooks.useUpdateHousehold,
        vars: { householdId: HOUSEHOLD, name: "Home" },
        invalidates: [queryKeys.household.detail(HOUSEHOLD), queryKeys.households()],
    },
    {
        name: "useDeleteHousehold",
        hook: householdHooks.useDeleteHousehold,
        // Takes the id as a bare string, unlike its siblings.
        vars: HOUSEHOLD,
        invalidates: [
            queryKeys.household.detail(HOUSEHOLD),
            queryKeys.households(),
            queryKeys.stores.all(),
        ],
    },
    {
        name: "useInviteMember",
        hook: householdHooks.useInviteMember,
        vars: { householdId: HOUSEHOLD, email: "a@b.test" },
        invalidates: [queryKeys.household.detail(HOUSEHOLD)],
    },
    {
        name: "useRemoveMember",
        hook: householdHooks.useRemoveMember,
        vars: { householdId: HOUSEHOLD, userId: "user-2" },
        invalidates: [
            queryKeys.household.detail(HOUSEHOLD),
            queryKeys.households(),
            queryKeys.stores.all(),
        ],
    },
    {
        name: "useAcceptInvitation",
        hook: householdHooks.useAcceptInvitation,
        vars: { token: "tok" },
        invalidates: [
            queryKeys.invitations(),
            queryKeys.households(),
            queryKeys.notificationCounts(),
        ],
    },
    {
        name: "useDeclineInvitation",
        hook: householdHooks.useDeclineInvitation,
        vars: { token: "tok" },
        invalidates: [queryKeys.invitations(), queryKeys.notificationCounts()],
    },
    {
        name: "useCancelInvitation",
        hook: householdHooks.useCancelInvitation,
        vars: { householdId: HOUSEHOLD, invitationId: INVITATION },
        invalidates: [queryKeys.household.invitations(HOUSEHOLD)],
    },
    {
        name: "useUpdateStoreHousehold",
        hook: invitationHooks.useUpdateStoreHousehold,
        vars: { storeId: STORE, householdId: HOUSEHOLD },
        invalidates: [queryKeys.stores.detail(STORE), queryKeys.stores.all()],
    },
    {
        name: "useUpdateStoreVisibility",
        hook: invitationHooks.useUpdateStoreVisibility,
        vars: { storeId: STORE, isHidden: true },
        invalidates: [queryKeys.stores.detail(STORE), queryKeys.stores.all()],
    },
];

const asSortedJson = (keys: unknown[][]): string[] => keys.map((k) => JSON.stringify(k)).sort();

describe("mutation cache cascades", () => {
    beforeEach(() => {
        harness.reset();
    });

    it.each(CASCADES.map((c) => [c.name, c] as const))(
        "%s invalidates exactly its documented keys",
        async (_name, cascade) => {
            if (cascade.stub) harness.stub(cascade.stub[0], cascade.stub[1]);

            const mutation = cascade.hook();
            const mutateAsync = mutation.mutateAsync as (variables: unknown) => Promise<unknown>;
            await mutateAsync(cascade.vars);

            // Everything after the mutation function resolved: `onSuccess` for plain mutations,
            // `onSettled` for optimistic ones. The `onMutate` phase is excluded on purpose — see
            // the Phase docs in hookHarness.ts.
            const actual = [
                ...harness.invalidatedIn("success"),
                ...harness.invalidatedIn("settled"),
            ].sort();

            // Set equality, not `toContain`: over-invalidating (e.g. the broad `["items"]`
            // prefix, which wipes every other store's cache) is as much a bug as missing a key.
            expect([...new Set(actual)]).toEqual([...new Set(asSortedJson(cascade.invalidates))]);
        }
    );
});

/**
 * Exports that are not `useMutation` hooks and therefore have no cascade to document.
 * Deliberately an explicit list rather than a name heuristic: the point of the guard below is
 * that anything new must be classified by a person, not silently skipped by a regex.
 */
const NON_MUTATION_HOOKS = new Set([
    // Query hooks
    "useStoreAisles",
    "useStoreSections",
    "useSection",
    "useStores",
    "useVisibleStores",
    "useStoreTemplates",
    "useQuantityUnits",
    "useStore",
    "useStoreSuspense",
    "useAppSetting",
    "useStoreItems",
    "useStoreItemsWithDetails",
    "useItem",
    "useShoppingListItems",
    "useShoppingListItemsIfLoaded",
    "useShoppingListItemsAllStores",
    "useStoreItemAutocomplete",
    "useHouseholds",
    "useHouseholdDetail",
    "usePendingInvitations",
    "useHouseholdInvitations",
    "useNotificationCounts",
    // Not a useMutation: a useCallback that orchestrates the aisle/section hooks above, each of
    // which already has its own cascade row.
    "useBulkApplyAislesAndSections",
]);

describe("cascade coverage", () => {
    it("documents a cascade for every mutation hook", () => {
        const modules = {
            ...aisleHooks,
            ...sectionHooks,
            ...storeHooks,
            ...itemHooks,
            ...shoppingListHooks,
            ...householdHooks,
            ...invitationHooks,
        };

        const mutationHooks = Object.entries(modules)
            .filter(([name, value]) => name.startsWith("use") && typeof value === "function")
            .map(([name]) => name)
            .filter((name) => !NON_MUTATION_HOOKS.has(name))
            .sort();

        // Adding a mutation hook without a row in CASCADES fails here. That is the whole point:
        // it is the enforcement the copilot-instructions ask for and prose cannot provide.
        expect(mutationHooks).toEqual(CASCADES.map((c) => c.name).sort());
    });
});

describe("optimistic mutation phases", () => {
    beforeEach(() => {
        harness.reset();
    });

    /**
     * `useOptimisticMutation` invalidates twice. The `onMutate` pass exists only to nudge
     * subscribers into re-rendering and passes `refetchType: "none"`; the real cascade happens in
     * `onSettled`. Pinned because a future refactor that drops the phase distinction would make
     * every assertion in this file quietly meaningless rather than red.
     */
    it("separates the onMutate notification pass from the settled cascade", async () => {
        const mutation = itemHooks.useToggleFavorite();
        await mutation.mutateAsync({ storeId: STORE, id: ITEM });

        const notifyPass = harness.calls.filter(
            (c) => c.phase === "mutate" && c.method === "invalidateQueries"
        );
        expect(notifyPass.length).toBeGreaterThan(0);
        expect(notifyPass.every((c) => c.refetchType === "none")).toBe(true);

        const settled = harness.calls.filter(
            (c) => c.phase === "settled" && c.method === "invalidateQueries"
        );
        expect(settled.length).toBeGreaterThan(0);
        expect(settled.every((c) => c.refetchType === undefined)).toBe(true);
    });

    it("applies the optimistic value to the real cache before the request resolves", async () => {
        harness.client.setQueryData(queryKeys.items.withDetails(STORE), [
            { id: ITEM, isFavorite: false },
        ]);

        const mutation = itemHooks.useToggleFavorite();
        await mutation.mutateAsync({ storeId: STORE, id: ITEM });

        const cached = harness.client.getQueryData(queryKeys.items.withDetails(STORE)) as {
            id: string;
            isFavorite: boolean;
        }[];
        expect(cached[0].isFavorite).toBe(true);
    });
});
