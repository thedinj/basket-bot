import { AuthorizationError, ConflictError } from "@basket-bot/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
    seedAisle,
    seedHousehold,
    seedHouseholdMember,
    seedStore,
    seedUser,
} from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import { db } from "../db/db";
import * as storeEntityService from "./storeEntityService";

/**
 * The copilot-instructions ask for a service test whenever a feature touches permissions or
 * sharing; this is that test for the service that owns both. `storeEntityService` is also one of
 * the most-churned files in the backend, and every one of its exports is a store-scoped operation
 * guarded by a single private `verifyStoreAccess` call — a guard that is easy to forget when
 * adding the next export.
 */

let owner: string;
let stranger: string;
let storeId: string;

beforeEach(() => {
    resetDb();
    owner = seedUser({ name: "Owner" });
    stranger = seedUser({ name: "Stranger" });
    storeId = seedStore({ ownerId: owner });
});

describe("store access control", () => {
    /**
     * Table-driven over the export list rather than one test per function: a new export that
     * forgets `verifyStoreAccess` should fail here without anyone remembering to add a case.
     * Each entry calls the export with a user who has no claim on the store at all.
     */
    const callAsStranger: Record<string, () => unknown> = {
        createAisle: () => storeEntityService.createAisle({ storeId, name: "X", userId: stranger }),
        getAislesByStore: () => storeEntityService.getAislesByStore(storeId, stranger),
        updateAisle: () =>
            storeEntityService.updateAisle({ id: "a", storeId, name: "X", userId: stranger }),
        reorderAisles: () =>
            storeEntityService.reorderAisles({ storeId, updates: [], userId: stranger }),
        deleteAisle: () => storeEntityService.deleteAisle("a", storeId, stranger),
        createSection: () =>
            storeEntityService.createSection({
                storeId,
                aisleId: "a",
                name: "X",
                userId: stranger,
            }),
        getSectionsByStore: () => storeEntityService.getSectionsByStore(storeId, stranger),
        updateSection: () =>
            storeEntityService.updateSection({ id: "s", storeId, name: "X", userId: stranger }),
        reorderSections: () =>
            storeEntityService.reorderSections({ storeId, updates: [], userId: stranger }),
        deleteSection: () => storeEntityService.deleteSection("s", storeId, stranger),
        createItem: () => storeEntityService.createItem({ storeId, name: "X", userId: stranger }),
        getItemsByStore: () => storeEntityService.getItemsByStore(storeId, stranger),
        getItemsByStoreWithDetails: () =>
            storeEntityService.getItemsByStoreWithDetails(storeId, stranger),
        updateItem: () =>
            storeEntityService.updateItem({ id: "i", storeId, name: "X", userId: stranger }),
        toggleItemFavorite: () => storeEntityService.toggleItemFavorite("i", storeId, stranger),
        deleteItem: () => storeEntityService.deleteItem("i", storeId, stranger),
        searchStoreItems: () => storeEntityService.searchStoreItems(storeId, "x", stranger),
        getOrCreateStoreItemByName: () =>
            storeEntityService.getOrCreateStoreItemByName({
                storeId,
                name: "X",
                userId: stranger,
            }),
        getShoppingListItems: () => storeEntityService.getShoppingListItems(storeId, stranger),
        updateAisleSortOrder: () =>
            storeEntityService.updateAisleSortOrder({
                id: "a",
                storeId,
                sortOrder: 1,
                userId: stranger,
            }),
        updateSectionLocation: () =>
            storeEntityService.updateSectionLocation({
                id: "s",
                storeId,
                aisleId: "a",
                sortOrder: 1,
                userId: stranger,
            }),
        upsertShoppingListItem: () =>
            storeEntityService.upsertShoppingListItem({
                id: "l",
                storeId,
                storeItemId: null,
                userId: stranger,
            }),
        toggleShoppingListItemChecked: () =>
            storeEntityService.toggleShoppingListItemChecked("l", true, storeId, stranger),
        removeShoppingListItem: () =>
            storeEntityService.removeShoppingListItem("l", storeId, stranger),
        deleteShoppingListItem: () =>
            storeEntityService.deleteShoppingListItem("l", storeId, stranger),
        clearCheckedShoppingListItems: () =>
            storeEntityService.clearCheckedShoppingListItems(storeId, stranger),
    };

    it.each(Object.keys(callAsStranger))("%s denies a user with no claim on the store", (name) => {
        expect(() => callAsStranger[name]()).toThrow(AuthorizationError);
    });

    it("covers every exported store-scoped function", () => {
        // Guards the table above from going stale: a new export lands here as a failure rather
        // than quietly escaping the permission sweep.
        const exported = Object.entries(storeEntityService)
            .filter(([, value]) => typeof value === "function")
            .map(([name]) => name)
            .sort();

        const untested = exported.filter((name) => !(name in callAsStranger));
        expect(untested).toEqual([]);
    });

    it("allows the store owner", () => {
        expect(() => storeEntityService.getAislesByStore(storeId, owner)).not.toThrow();
    });
});

describe("household sharing", () => {
    it("grants access to a member of the store's household", () => {
        const householdId = seedHousehold({ ownerId: owner });
        const sharedStore = seedStore({ ownerId: owner, householdId });
        const member = seedUser({ name: "Member" });
        seedHouseholdMember({ householdId, userId: member });

        expect(() => storeEntityService.getAislesByStore(sharedStore, member)).not.toThrow();
    });

    it("denies a member of a different household", () => {
        const householdId = seedHousehold({ ownerId: owner });
        const sharedStore = seedStore({ ownerId: owner, householdId });

        const otherHousehold = seedHousehold({ ownerId: stranger, name: "Other" });
        seedHouseholdMember({ householdId: otherHousehold, userId: stranger });

        expect(() => storeEntityService.getAislesByStore(sharedStore, stranger)).toThrow(
            AuthorizationError
        );
    });

    it("denies a former member once they leave the household", () => {
        const householdId = seedHousehold({ ownerId: owner });
        const sharedStore = seedStore({ ownerId: owner, householdId });
        const member = seedUser({ name: "Member" });
        seedHouseholdMember({ householdId, userId: member });

        db.prepare(`DELETE FROM HouseholdMember WHERE userId = ?`).run(member);

        expect(() => storeEntityService.getAislesByStore(sharedStore, member)).toThrow(
            AuthorizationError
        );
    });
});

describe("name conflicts", () => {
    it("rejects an aisle whose name differs only by case or whitespace", () => {
        storeEntityService.createAisle({ storeId, name: "Produce", userId: owner });

        expect(() =>
            storeEntityService.createAisle({ storeId, name: "  produce  ", userId: owner })
        ).toThrow(ConflictError);
    });

    it("reports the aisle conflict with a specific code", () => {
        storeEntityService.createAisle({ storeId, name: "Produce", userId: owner });

        try {
            storeEntityService.createAisle({ storeId, name: "produce", userId: owner });
            expect.unreachable("expected a ConflictError");
        } catch (error) {
            expect(error).toBeInstanceOf(ConflictError);
            expect((error as ConflictError).code).toBe("AISLE_NAME_CONFLICT");
        }
    });

    it("allows the same aisle name in a different store", () => {
        const otherStore = seedStore({ ownerId: owner, name: "Other" });
        storeEntityService.createAisle({ storeId, name: "Produce", userId: owner });

        expect(() =>
            storeEntityService.createAisle({ storeId: otherStore, name: "Produce", userId: owner })
        ).not.toThrow();
    });

    // Sections are unique per (store, aisle), not per store — the same section name under two
    // different aisles is legitimate and must not be rejected.
    it("scopes section name conflicts to the aisle", () => {
        const aisleA = seedAisle({ storeId, ownerId: owner, name: "Produce" });
        const aisleB = seedAisle({ storeId, ownerId: owner, name: "Frozen" });

        storeEntityService.createSection({
            storeId,
            aisleId: aisleA,
            name: "Berries",
            userId: owner,
        });

        expect(() =>
            storeEntityService.createSection({
                storeId,
                aisleId: aisleB,
                name: "Berries",
                userId: owner,
            })
        ).not.toThrow();

        expect(() =>
            storeEntityService.createSection({
                storeId,
                aisleId: aisleA,
                name: "  berries ",
                userId: owner,
            })
        ).toThrow(ConflictError);
    });

    it("scopes item name conflicts to the store", () => {
        storeEntityService.createItem({ storeId, name: "Apples", userId: owner });

        expect(() =>
            storeEntityService.createItem({ storeId, name: "  APPLES ", userId: owner })
        ).toThrow(ConflictError);
    });

    /**
     * The pre-check exists so a duplicate is reported as a named conflict rather than escaping as
     * a raw `UNIQUE (storeId, nameNorm)` violation. Both end up as a 409, but only the typed error
     * carries a code and a message naming the offending item.
     */
    it("reports the item conflict with a specific code and the existing name", () => {
        storeEntityService.createItem({ storeId, name: "Apples", userId: owner });

        try {
            storeEntityService.createItem({ storeId, name: "apples", userId: owner });
            expect.unreachable("expected a ConflictError");
        } catch (error) {
            expect(error).toBeInstanceOf(ConflictError);
            expect((error as ConflictError).code).toBe("ITEM_NAME_CONFLICT");
            expect((error as ConflictError).message).toContain("Apples");
        }
    });

    it("allows the same item name in a different store", () => {
        const otherStore = seedStore({ ownerId: owner, name: "Other" });
        storeEntityService.createItem({ storeId, name: "Apples", userId: owner });

        expect(() =>
            storeEntityService.createItem({ storeId: otherStore, name: "Apples", userId: owner })
        ).not.toThrow();
    });

    // Singular and plural are different items on purpose: `normalizeItemName` does not
    // singularize, and the client must not assume it does.
    it("treats singular and plural item names as distinct", () => {
        storeEntityService.createItem({ storeId, name: "Apple", userId: owner });

        expect(() =>
            storeEntityService.createItem({ storeId, name: "Apples", userId: owner })
        ).not.toThrow();
    });
});
