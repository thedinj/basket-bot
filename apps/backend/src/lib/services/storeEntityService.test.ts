import {
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from "@basket-bot/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    seedAisle,
    seedHousehold,
    seedHouseholdMember,
    seedItem,
    seedListItem,
    seedSection,
    seedStore,
    seedUser,
} from "../../../test/support/fixtures";
import { recordStoreEvents } from "../../../test/support/recordStoreEvents";
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
        mergeItems: () =>
            storeEntityService.mergeItems({
                loserId: "i",
                intoItemId: "j",
                storeId,
                userId: stranger,
            }),
        toggleItemFavorite: () => storeEntityService.toggleItemFavorite("i", storeId, stranger),
        deleteItem: () => storeEntityService.deleteItem("i", storeId, stranger),
        getOrphanItems: () => storeEntityService.getOrphanItems(storeId, stranger),
        deleteOrphanItems: () => storeEntityService.deleteOrphanItems(storeId, ["i"], stranger),
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

/**
 * `mergeItems` is the front door to `itemRepo.mergeItemInto`, opened so Auto-Locate's duplicate
 * detection can fold "Mozzarella, shredded" into an existing "Shredded mozzarella". It deletes a
 * row, so the guards around *which* row matter as much as the merge itself.
 */
describe("merging duplicate items", () => {
    let aisleId: string;
    let sectionId: string;

    beforeEach(() => {
        aisleId = seedAisle({ storeId, ownerId: owner, name: "Dairy" });
        sectionId = seedSection({ storeId, aisleId, ownerId: owner, name: "Cheese" });
    });

    it("repoints the loser's list rows onto the winner and deletes the loser", () => {
        const winner = seedItem({
            storeId,
            ownerId: owner,
            name: "Shredded mozzarella",
            sectionId,
        });
        const loser = seedItem({ storeId, ownerId: owner, name: "Mozzarella, shredded" });
        const listItem = seedListItem({ storeId, ownerId: owner, storeItemId: loser });

        const survivor = storeEntityService.mergeItems({
            loserId: loser,
            intoItemId: winner,
            storeId,
            userId: owner,
        });

        expect(survivor.id).toBe(winner);
        expect(
            db.prepare(`SELECT storeItemId FROM ShoppingListItem WHERE id = ?`).get(listItem)
        ).toEqual({ storeItemId: winner });
        expect(db.prepare(`SELECT id FROM StoreItem WHERE id = ?`).get(loser)).toBeUndefined();
    });

    it("renames the survivor when a canonical name is given, keeping its location", () => {
        const winner = seedItem({
            storeId,
            ownerId: owner,
            name: "Mozzarella, shredded",
            sectionId,
        });
        const loser = seedItem({ storeId, ownerId: owner, name: "Shredded mozzarella" });

        const survivor = storeEntityService.mergeItems({
            loserId: loser,
            intoItemId: winner,
            storeId,
            canonicalName: "Shredded mozzarella",
            userId: owner,
        });

        expect(survivor.id).toBe(winner);
        expect(survivor.name).toBe("Shredded mozzarella");
        expect(survivor.sectionId).toBe(sectionId);
        expect(survivor.aisleId).toBeNull();
    });

    it("refuses to merge an item into itself", () => {
        const item = seedItem({ storeId, ownerId: owner, name: "Milk" });

        expect(() =>
            storeEntityService.mergeItems({
                loserId: item,
                intoItemId: item,
                storeId,
                userId: owner,
            })
        ).toThrow(ValidationError);
    });

    // The store id comes from the URL while both item ids come from the body, so a caller with
    // access to one store could otherwise name items belonging to another.
    it("refuses to merge an item that belongs to a different store", () => {
        const otherStore = seedStore({ ownerId: owner, name: "Other" });
        const mine = seedItem({ storeId, ownerId: owner, name: "Milk" });
        const theirs = seedItem({ storeId: otherStore, ownerId: owner, name: "Milk" });

        expect(() =>
            storeEntityService.mergeItems({
                loserId: mine,
                intoItemId: theirs,
                storeId,
                userId: owner,
            })
        ).toThrow(NotFoundError);
    });

    /**
     * Notes live on `ShoppingListItem`, not `StoreItem`, and a merge only repoints
     * `storeItemId` — it must not touch the per-row detail the user typed. The case that
     * matters is both sides already being on the list with *different* notes: nothing may be
     * overwritten and nothing silently dropped, because a note is often the only reason an
     * entry exists ("for lasagna" vs "for the salad").
     */
    it("preserves the notes, qty and unit on both sides' list rows", () => {
        const winner = seedItem({
            storeId,
            ownerId: owner,
            name: "Green peppers",
            sectionId,
        });
        const loser = seedItem({ storeId, ownerId: owner, name: "Peppers, green" });

        const winnerRow = seedListItem({
            storeId,
            ownerId: owner,
            storeItemId: winner,
            notes: "for the salad",
            qty: 2,
        });
        const loserRow = seedListItem({
            storeId,
            ownerId: owner,
            storeItemId: loser,
            notes: "for lasagna",
            qty: 5,
        });

        storeEntityService.mergeItems({
            loserId: loser,
            intoItemId: winner,
            storeId,
            userId: owner,
        });

        const rows = storeEntityService.getShoppingListItems(storeId, owner);

        // Both entries survive as separate rows pointing at the survivor.
        expect(rows).toHaveLength(2);
        expect(rows.every((r) => r.storeItemId === winner)).toBe(true);

        const byId = new Map(rows.map((r) => [r.id, r]));
        expect(byId.get(winnerRow)?.notes).toBe("for the salad");
        expect(byId.get(winnerRow)?.qty).toBe(2);
        expect(byId.get(loserRow)?.notes).toBe("for lasagna");
        expect(byId.get(loserRow)?.qty).toBe(5);
    });

    it("keeps the loser's note when the survivor is also renamed", () => {
        const winner = seedItem({
            storeId,
            ownerId: owner,
            name: "Mozzarella, shredded",
            sectionId,
        });
        const loser = seedItem({ storeId, ownerId: owner, name: "Shredded mozzarella" });
        const row = seedListItem({
            storeId,
            ownerId: owner,
            storeItemId: loser,
            notes: "block, not bagged",
        });

        storeEntityService.mergeItems({
            loserId: loser,
            intoItemId: winner,
            storeId,
            canonicalName: "Shredded mozzarella",
            userId: owner,
        });

        const merged = storeEntityService
            .getShoppingListItems(storeId, owner)
            .find((r) => r.id === row);

        expect(merged?.notes).toBe("block, not bagged");
        expect(merged?.itemName).toBe("Shredded mozzarella");
    });

    it("reports a missing item rather than silently doing nothing", () => {
        const item = seedItem({ storeId, ownerId: owner, name: "Milk" });

        expect(() =>
            storeEntityService.mergeItems({
                loserId: crypto.randomUUID(),
                intoItemId: item,
                storeId,
                userId: owner,
            })
        ).toThrow(NotFoundError);
    });
});

describe("aisle emoji", () => {
    it("stores an emoji given at create time", () => {
        const aisle = storeEntityService.createAisle({
            storeId,
            name: "Produce",
            emoji: "🥬",
            userId: owner,
        });

        expect(aisle.emoji).toBe("🥬");
    });

    it("defaults to no emoji", () => {
        const aisle = storeEntityService.createAisle({ storeId, name: "Aisle 3", userId: owner });

        expect(aisle.emoji).toBeNull();
    });

    it("leaves the emoji alone when an update omits it", () => {
        const id = seedAisle({ storeId, ownerId: owner, name: "Deli", emoji: "🧀" });

        const updated = storeEntityService.updateAisle({
            id,
            storeId,
            name: "Deli Counter",
            userId: owner,
        });

        expect(updated?.name).toBe("Deli Counter");
        expect(updated?.emoji).toBe("🧀");
    });

    it("clears the emoji on null or blank", () => {
        const id = seedAisle({ storeId, ownerId: owner, name: "Deli", emoji: "🧀" });

        expect(
            storeEntityService.updateAisle({
                id,
                storeId,
                name: "Deli",
                emoji: null,
                userId: owner,
            })?.emoji
        ).toBeNull();

        storeEntityService.updateAisle({ id, storeId, name: "Deli", emoji: "🧀", userId: owner });
        expect(
            storeEntityService.updateAisle({
                id,
                storeId,
                name: "Deli",
                emoji: "  ",
                userId: owner,
            })?.emoji
        ).toBeNull();
    });

    it.each(["cheese", "🧀🥖", "7"])("rejects %j as an emoji", (emoji) => {
        expect(() =>
            storeEntityService.createAisle({ storeId, name: "Deli", emoji, userId: owner })
        ).toThrow(ValidationError);
    });
});

describe("store scoping of ids", () => {
    /**
     * The URL's store is where access is checked, so an id from another store must not be
     * reachable through it: the caller could otherwise write to (and publish events for) a store
     * they have no claim on. A foreign id reads as a 404, the same as a missing one.
     */
    let otherStore: string;
    let foreignListItem: string;
    let foreignStoreItem: string;

    const listRow = (id: string) =>
        db.prepare(`SELECT isChecked, notes FROM ShoppingListItem WHERE id = ?`).get(id) as
            | { isChecked: number | null; notes: string | null }
            | undefined;

    beforeEach(() => {
        otherStore = seedStore({ ownerId: stranger });
        foreignStoreItem = seedItem({ storeId: otherStore, ownerId: stranger, name: "Theirs" });
        foreignListItem = seedListItem({
            storeId: otherStore,
            storeItemId: foreignStoreItem,
            notes: "original",
            ownerId: stranger,
        });
    });

    it("toggle refuses a list item from another store and changes nothing", () => {
        expect(() =>
            storeEntityService.toggleShoppingListItemChecked(foreignListItem, true, storeId, owner)
        ).toThrow(NotFoundError);
        expect(listRow(foreignListItem)?.isChecked).toBeNull();
    });

    it("remove refuses a list item from another store and changes nothing", () => {
        expect(() =>
            storeEntityService.removeShoppingListItem(foreignListItem, storeId, owner)
        ).toThrow(NotFoundError);
        expect(listRow(foreignListItem)).toBeDefined();
    });

    it("delete-with-item refuses a list item from another store and changes nothing", () => {
        expect(() =>
            storeEntityService.deleteShoppingListItem(foreignListItem, storeId, owner)
        ).toThrow(NotFoundError);
        expect(listRow(foreignListItem)).toBeDefined();
        expect(
            db.prepare(`SELECT 1 FROM StoreItem WHERE id = ?`).get(foreignStoreItem)
        ).toBeDefined();
    });

    it("the update branch of upsert refuses a list item from another store", () => {
        expect(() =>
            storeEntityService.upsertShoppingListItem({
                id: foreignListItem,
                storeId,
                notes: "hijacked",
                userId: owner,
            })
        ).toThrow(NotFoundError);
        expect(listRow(foreignListItem)?.notes).toBe("original");
    });

    it("still reports a missing list item as not found", () => {
        expect(() =>
            storeEntityService.toggleShoppingListItemChecked(
                crypto.randomUUID(),
                true,
                storeId,
                owner
            )
        ).toThrow(NotFoundError);
    });

    it("refuses aisle, section and item ids from another store", () => {
        const aisle = seedAisle({ storeId: otherStore, ownerId: stranger, name: "Theirs" });
        const section = seedSection({
            storeId: otherStore,
            aisleId: aisle,
            ownerId: stranger,
            name: "Theirs",
        });
        const attempts: Array<() => unknown> = [
            () => storeEntityService.updateAisle({ id: aisle, storeId, name: "X", userId: owner }),
            () =>
                storeEntityService.updateAisleSortOrder({
                    id: aisle,
                    storeId,
                    sortOrder: 5,
                    userId: owner,
                }),
            () => storeEntityService.deleteAisle(aisle, storeId, owner),
            () =>
                storeEntityService.updateSection({
                    id: section,
                    storeId,
                    name: "X",
                    userId: owner,
                }),
            () =>
                storeEntityService.updateSectionLocation({
                    id: section,
                    storeId,
                    aisleId: aisle,
                    sortOrder: 5,
                    userId: owner,
                }),
            () => storeEntityService.deleteSection(section, storeId, owner),
            () =>
                storeEntityService.updateItem({
                    id: foreignStoreItem,
                    storeId,
                    name: "X",
                    userId: owner,
                }),
            () => storeEntityService.toggleItemFavorite(foreignStoreItem, storeId, owner),
            () => storeEntityService.deleteItem(foreignStoreItem, storeId, owner),
        ];

        for (const attempt of attempts) {
            expect(attempt).toThrow(NotFoundError);
        }
        expect(db.prepare(`SELECT name FROM StoreAisle WHERE id = ?`).get(aisle)).toEqual({
            name: "Theirs",
        });
        expect(db.prepare(`SELECT name FROM StoreSection WHERE id = ?`).get(section)).toEqual({
            name: "Theirs",
        });
        expect(db.prepare(`SELECT name FROM StoreItem WHERE id = ?`).get(foreignStoreItem)).toEqual(
            { name: "Theirs" }
        );
    });

    it("reorder ignores ids from another store", () => {
        const mine = seedAisle({ storeId, ownerId: owner, name: "Mine", sortOrder: 0 });
        const theirs = seedAisle({
            storeId: otherStore,
            ownerId: stranger,
            name: "Theirs",
            sortOrder: 0,
        });

        storeEntityService.reorderAisles({
            storeId,
            updates: [
                { id: mine, sortOrder: 3 },
                { id: theirs, sortOrder: 9 },
            ],
            userId: owner,
        });

        const sortOf = (id: string) =>
            (
                db.prepare(`SELECT sortOrder FROM StoreAisle WHERE id = ?`).get(id) as {
                    sortOrder: number;
                }
            ).sortOrder;
        expect(sortOf(mine)).toBe(3);
        expect(sortOf(theirs)).toBe(0);
    });
});

describe("store scoping of body foreign keys", () => {
    /**
     * The row a request acts on is checked above; these are the ids it *points at* — an item's
     * aisle/section, a section's target aisle, a list row's store item. Each must be the URL
     * store's own, or the write would link this store's rows to another store's (and leak that
     * store's names back through the joined read models). A foreign id is the same 404 as a
     * missing one; nothing is written and nothing is published.
     */
    let otherStore: string;
    let myAisle: string;
    let myOtherAisle: string;
    let mySection: string;
    let myItem: string;
    let myListItem: string;
    let foreignAisle: string;
    let foreignSection: string;
    let foreignItem: string;

    const tableCounts = () =>
        Object.fromEntries(
            ["StoreAisle", "StoreSection", "StoreItem", "ShoppingListItem"].map((table) => [
                table,
                (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n,
            ])
        );
    const snapshot = () => ({
        counts: tableCounts(),
        section: db.prepare(`SELECT * FROM StoreSection WHERE id = ?`).get(mySection),
        item: db.prepare(`SELECT * FROM StoreItem WHERE id = ?`).get(myItem),
        listItem: db.prepare(`SELECT * FROM ShoppingListItem WHERE id = ?`).get(myListItem),
    });

    beforeEach(() => {
        otherStore = seedStore({ ownerId: stranger });
        myAisle = seedAisle({ storeId, ownerId: owner, name: "Mine" });
        myOtherAisle = seedAisle({ storeId, ownerId: owner, name: "Mine too", sortOrder: 1 });
        mySection = seedSection({ storeId, aisleId: myAisle, ownerId: owner, name: "Mine" });
        myItem = seedItem({ storeId, ownerId: owner, name: "Milk" });
        myListItem = seedListItem({ storeId, storeItemId: myItem, ownerId: owner });
        foreignAisle = seedAisle({ storeId: otherStore, ownerId: stranger, name: "Theirs" });
        foreignSection = seedSection({
            storeId: otherStore,
            aisleId: foreignAisle,
            ownerId: stranger,
            name: "Theirs",
        });
        foreignItem = seedItem({ storeId: otherStore, ownerId: stranger, name: "Theirs" });
    });

    /** Each writer, called with one body foreign key pointing at another store's row. */
    const foreignWrites: Array<[string, () => unknown]> = [
        [
            "createSection with a foreign aisleId",
            () =>
                storeEntityService.createSection({
                    storeId,
                    aisleId: foreignAisle,
                    name: "New",
                    userId: owner,
                }),
        ],
        [
            "updateSection with a foreign aisleId",
            () =>
                storeEntityService.updateSection({
                    id: mySection,
                    storeId,
                    aisleId: foreignAisle,
                    userId: owner,
                }),
        ],
        [
            "updateSection with a foreign aisleId and a rename",
            () =>
                storeEntityService.updateSection({
                    id: mySection,
                    storeId,
                    name: "Renamed",
                    aisleId: foreignAisle,
                    userId: owner,
                }),
        ],
        [
            "updateSectionLocation with a foreign aisleId",
            () =>
                storeEntityService.updateSectionLocation({
                    id: mySection,
                    storeId,
                    aisleId: foreignAisle,
                    sortOrder: 4,
                    userId: owner,
                }),
        ],
        [
            "createItem with a foreign aisleId",
            () =>
                storeEntityService.createItem({
                    storeId,
                    name: "Bread",
                    aisleId: foreignAisle,
                    userId: owner,
                }),
        ],
        [
            "createItem with a foreign sectionId",
            () =>
                storeEntityService.createItem({
                    storeId,
                    name: "Bread",
                    sectionId: foreignSection,
                    userId: owner,
                }),
        ],
        [
            "updateItem with a foreign aisleId",
            () =>
                storeEntityService.updateItem({
                    id: myItem,
                    storeId,
                    name: "Milk",
                    aisleId: foreignAisle,
                    userId: owner,
                }),
        ],
        [
            "updateItem with a foreign sectionId",
            () =>
                storeEntityService.updateItem({
                    id: myItem,
                    storeId,
                    name: "Milk",
                    sectionId: foreignSection,
                    userId: owner,
                }),
        ],
        [
            "getOrCreateStoreItemByName (new item) with a foreign aisleId",
            () =>
                storeEntityService.getOrCreateStoreItemByName({
                    storeId,
                    name: "Bread",
                    aisleId: foreignAisle,
                    userId: owner,
                }),
        ],
        [
            "getOrCreateStoreItemByName (existing item) with a foreign sectionId",
            () =>
                storeEntityService.getOrCreateStoreItemByName({
                    storeId,
                    name: "Milk",
                    sectionId: foreignSection,
                    userId: owner,
                }),
        ],
        [
            "upsertShoppingListItem (insert) with a foreign storeItemId",
            () =>
                storeEntityService.upsertShoppingListItem({
                    storeId,
                    storeItemId: foreignItem,
                    userId: owner,
                }),
        ],
        [
            "upsertShoppingListItem (update) with a foreign storeItemId",
            () =>
                storeEntityService.upsertShoppingListItem({
                    id: myListItem,
                    storeId,
                    storeItemId: foreignItem,
                    userId: owner,
                }),
        ],
    ];

    it.each(foreignWrites)("%s is refused as not found and writes nothing", (_name, write) => {
        const before = snapshot();
        const recorder = recordStoreEvents(storeId, otherStore);

        expect(write).toThrow(NotFoundError);

        expect(snapshot()).toEqual(before);
        expect(recorder.events).toEqual([]);
        recorder.stop();
    });

    it.each(foreignWrites)("%s gets the same 404 once the id no longer exists", (_name, write) => {
        // Deleting the other store cascades its rows away, turning every foreign id into a
        // missing one: the caller must not be able to tell the two cases apart.
        db.prepare(`DELETE FROM Store WHERE id = ?`).run(otherStore);
        expect(write).toThrow(NotFoundError);
    });

    it("accepts same-store aisle, section and store item ids", () => {
        const section = storeEntityService.createSection({
            storeId,
            aisleId: myAisle,
            name: "Dairy",
            userId: owner,
        });
        expect(section.aisleId).toBe(myAisle);

        expect(
            storeEntityService.updateSection({
                id: section.id,
                storeId,
                aisleId: myOtherAisle,
                userId: owner,
            })?.aisleId
        ).toBe(myOtherAisle);

        expect(
            storeEntityService.updateSectionLocation({
                id: section.id,
                storeId,
                aisleId: myAisle,
                sortOrder: 2,
                userId: owner,
            })?.aisleId
        ).toBe(myAisle);

        const bread = storeEntityService.createItem({
            storeId,
            name: "Bread",
            aisleId: myAisle,
            userId: owner,
        });
        expect(bread.aisleId).toBe(myAisle);

        // Section plus its own aisle: the section wins and the item's aisleId is stored NULL.
        const updated = storeEntityService.updateItem({
            id: bread.id,
            storeId,
            name: "Bread",
            aisleId: myAisle,
            sectionId: mySection,
            userId: owner,
        });
        expect(updated).toMatchObject({ aisleId: null, sectionId: mySection });

        expect(
            storeEntityService.getOrCreateStoreItemByName({
                storeId,
                name: "Eggs",
                sectionId: mySection,
                userId: owner,
            })
        ).toMatchObject({ aisleId: null, sectionId: mySection });

        const listItem = storeEntityService.upsertShoppingListItem({
            storeId,
            storeItemId: bread.id,
            userId: owner,
        });
        expect(listItem.storeItemId).toBe(bread.id);
    });

    it("keeps null and omitted location ids working", () => {
        const item = storeEntityService.createItem({
            storeId,
            name: "Bread",
            aisleId: null,
            sectionId: null,
            userId: owner,
        });
        expect(item).toMatchObject({ aisleId: null, sectionId: null });
        expect(
            storeEntityService.upsertShoppingListItem({
                storeId,
                storeItemId: null,
                isIdea: true,
                notes: "something for dinner",
                userId: owner,
            }).storeItemId
        ).toBeNull();
    });

    it("drops rather than refuses a stray storeItemId on an idea, which never stores one", () => {
        const idea = storeEntityService.upsertShoppingListItem({
            storeId,
            storeItemId: foreignItem,
            isIdea: true,
            notes: "something for dinner",
            userId: owner,
        });
        expect(idea.storeItemId).toBeNull();
    });

    const mismatchedLocations: Array<[string, () => unknown]> = [
        [
            "createItem",
            () =>
                storeEntityService.createItem({
                    storeId,
                    name: "Bread",
                    aisleId: myOtherAisle,
                    sectionId: mySection,
                    userId: owner,
                }),
        ],
        [
            "updateItem",
            () =>
                storeEntityService.updateItem({
                    id: myItem,
                    storeId,
                    name: "Milk",
                    aisleId: myOtherAisle,
                    sectionId: mySection,
                    userId: owner,
                }),
        ],
        [
            "getOrCreateStoreItemByName",
            () =>
                storeEntityService.getOrCreateStoreItemByName({
                    storeId,
                    name: "Milk",
                    aisleId: myOtherAisle,
                    sectionId: mySection,
                    userId: owner,
                }),
        ],
    ];

    it.each(mismatchedLocations)(
        "%s refuses a section that is not in the given aisle",
        (_name, write) => {
            const before = snapshot();
            const recorder = recordStoreEvents(storeId);

            expect(write).toThrow(ValidationError);

            expect(snapshot()).toEqual(before);
            expect(recorder.events).toEqual([]);
            recorder.stop();
        }
    );
});

describe("store change events", () => {
    /**
     * Every writer tells the store's open streams what changed, keyed on the store the row
     * belongs to. Recorded on the real bus, so this is what a connected phone would hear.
     */
    let recorder: ReturnType<typeof recordStoreEvents>;

    beforeEach(() => {
        recorder = recordStoreEvents(storeId);
    });

    afterEach(() => {
        recorder.stop();
    });

    it("publishes `list` for adding and editing a list item", () => {
        const item = storeEntityService.upsertShoppingListItem({
            storeId,
            storeItemId: seedItem({ storeId, ownerId: owner, name: "Milk" }),
            userId: owner,
        });
        storeEntityService.upsertShoppingListItem({
            id: item.id,
            storeId,
            notes: "2%",
            userId: owner,
        });

        expect(recorder.pairs()).toEqual([
            [storeId, "list"],
            [storeId, "list"],
        ]);
    });

    it("publishes `list` for a check and an uncheck", () => {
        const id = seedListItem({ storeId, ownerId: owner });

        storeEntityService.toggleShoppingListItemChecked(id, true, storeId, owner);
        storeEntityService.toggleShoppingListItemChecked(id, false, storeId, owner);

        expect(recorder.pairs()).toEqual([
            [storeId, "list"],
            [storeId, "list"],
        ]);
    });

    it("publishes nothing for a check that conflicts, since nothing was written", () => {
        const member = seedUser({ name: "Member" });
        const householdId = seedHousehold({ ownerId: owner });
        seedHouseholdMember({ householdId, userId: owner });
        seedHouseholdMember({ householdId, userId: member });
        db.prepare(`UPDATE Store SET householdId = ? WHERE id = ?`).run(householdId, storeId);
        const id = seedListItem({ storeId, ownerId: owner });
        storeEntityService.toggleShoppingListItemChecked(id, true, storeId, owner);
        recorder.events.length = 0;

        const result = storeEntityService.toggleShoppingListItemChecked(id, true, storeId, member);

        expect(result.conflict).toBe(true);
        expect(recorder.events).toEqual([]);
    });

    it("publishes `list` for remove and clear-checked, and nothing for an empty clear", () => {
        const id = seedListItem({ storeId, ownerId: owner });
        seedListItem({ storeId, ownerId: owner, isChecked: true });

        storeEntityService.removeShoppingListItem(id, storeId, owner);
        storeEntityService.clearCheckedShoppingListItems(storeId, owner);
        storeEntityService.clearCheckedShoppingListItems(storeId, owner);

        expect(recorder.pairs()).toEqual([
            [storeId, "list"],
            [storeId, "list"],
        ]);
    });

    it("publishes `layout` for delete-with-item, which also deletes the store item", () => {
        const storeItemId = seedItem({ storeId, ownerId: owner, name: "Milk" });
        const id = seedListItem({ storeId, storeItemId, ownerId: owner });

        storeEntityService.deleteShoppingListItem(id, storeId, owner);

        expect(recorder.pairs()).toEqual([[storeId, "layout"]]);
    });

    it("publishes `layout` for aisle and section writes", () => {
        const aisle = storeEntityService.createAisle({ storeId, name: "Dairy", userId: owner });
        storeEntityService.updateAisle({ id: aisle.id, storeId, name: "Milk", userId: owner });
        storeEntityService.updateAisleSortOrder({
            id: aisle.id,
            storeId,
            sortOrder: 4,
            userId: owner,
        });
        storeEntityService.reorderAisles({
            storeId,
            updates: [{ id: aisle.id, sortOrder: 1 }],
            userId: owner,
        });
        const section = storeEntityService.createSection({
            storeId,
            aisleId: aisle.id,
            name: "Cheese",
            userId: owner,
        });
        storeEntityService.updateSection({ id: section.id, storeId, name: "Brie", userId: owner });
        storeEntityService.updateSectionLocation({
            id: section.id,
            storeId,
            aisleId: aisle.id,
            sortOrder: 2,
            userId: owner,
        });
        storeEntityService.reorderSections({
            storeId,
            updates: [{ id: section.id, sortOrder: 0 }],
            userId: owner,
        });
        storeEntityService.deleteSection(section.id, storeId, owner);
        storeEntityService.deleteAisle(aisle.id, storeId, owner);

        expect(recorder.pairs()).toEqual(Array(10).fill([storeId, "layout"]));
    });

    it("publishes `layout` for item writes, once per merge", () => {
        const milk = storeEntityService.createItem({ storeId, name: "Milk", userId: owner });
        const soy = seedItem({ storeId, ownerId: owner, name: "Soy milk" });
        const oat = seedItem({ storeId, ownerId: owner, name: "Oat milk" });
        storeEntityService.updateItem({ id: milk.id, storeId, name: "Whole milk", userId: owner });
        storeEntityService.toggleItemFavorite(milk.id, storeId, owner);
        storeEntityService.mergeItems({
            loserId: soy,
            intoItemId: milk.id,
            storeId,
            canonicalName: "Milk",
            userId: owner,
        });
        storeEntityService.deleteItem(oat, storeId, owner);

        expect(recorder.pairs()).toEqual(Array(5).fill([storeId, "layout"]));
    });

    it("publishes `layout` for deleting orphans, and nothing when none were deleted", () => {
        const orphan = seedItem({ storeId, ownerId: owner, name: "Lonely" });

        storeEntityService.deleteOrphanItems(storeId, [orphan], owner);
        storeEntityService.deleteOrphanItems(storeId, [orphan], owner);

        expect(recorder.pairs()).toEqual([[storeId, "layout"]]);
    });

    it("publishes nothing when a write is refused", () => {
        expect(() =>
            storeEntityService.createAisle({ storeId, name: "X", userId: stranger })
        ).toThrow(AuthorizationError);
        expect(recorder.events).toEqual([]);
    });

    it("publishes nothing for reads", () => {
        storeEntityService.getShoppingListItems(storeId, owner);
        storeEntityService.getItemsByStoreWithDetails(storeId, owner);
        storeEntityService.getAislesByStore(storeId, owner);

        expect(recorder.events).toEqual([]);
    });
});

/**
 * The bug this covers came from the client faking get-or-create: it searched, found no exact
 * match in the one row it asked for, and asked to create a name that already existed. The data
 * that broke it is below — a store where a *longer* name outranks the exact one because it has
 * been used more.
 */
describe("getOrCreateStoreItemByName", () => {
    it("returns the existing item even when better-used items share its prefix", () => {
        const exact = seedItem({
            storeId,
            name: "Chocolate chips",
            usageCount: 1,
            ownerId: owner,
        });
        seedItem({ storeId, name: "Chocolate chips, mini", usageCount: 2, ownerId: owner });
        seedItem({ storeId, name: "Semi-sweet chocolate chips", usageCount: 1, ownerId: owner });

        const item = storeEntityService.getOrCreateStoreItemByName({
            storeId,
            name: "Chocolate chips",
            userId: owner,
        });

        expect(item.id).toBe(exact);
    });

    // Search skips hidden items; the uniqueness constraint does not. Resolving by name has to
    // see what the constraint sees, or the item is unaddable for good.
    it("returns a hidden item rather than trying to create a second one", () => {
        const hidden = seedItem({
            storeId,
            name: "Chocolate chips",
            isHidden: true,
            ownerId: owner,
        });

        const item = storeEntityService.getOrCreateStoreItemByName({
            storeId,
            name: "Chocolate chips",
            userId: owner,
        });

        expect(item.id).toBe(hidden);
    });

    // `nameNorm` collapses whitespace and case; a display-name comparison does not.
    it("matches on the normalized name, not the display name", () => {
        const existing = seedItem({ storeId, name: "Chocolate chips", ownerId: owner });

        const item = storeEntityService.getOrCreateStoreItemByName({
            storeId,
            name: "  CHOCOLATE   chips ",
            userId: owner,
        });

        expect(item.id).toBe(existing);
    });

    it("creates the item when the store really hasn't got one", () => {
        const item = storeEntityService.getOrCreateStoreItemByName({
            storeId,
            name: "Chocolate chips",
            userId: owner,
        });

        expect(item.name).toBe("Chocolate chips");
        expect(
            db.prepare(`SELECT COUNT(*) AS n FROM "StoreItem" WHERE storeId = ?`).get(storeId)
        ).toEqual({ n: 1 });
    });
});
