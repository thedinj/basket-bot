import { beforeEach, describe, expect, it } from "vitest";
import {
    seedAisle,
    seedItem,
    seedListItem,
    seedSection,
    seedStore,
    seedUser,
} from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import * as shoppingListRepo from "./shoppingListRepo";

/**
 * The shopping-list query is the most-read statement in the app and the most joined: it resolves
 * an item's aisle through its section, filters private rows per viewer, and orders by two
 * nullable sort columns. Each of those is a place where a wrong answer looks like a UI bug.
 */

let owner: string;
let storeId: string;

beforeEach(() => {
    resetDb();
    owner = seedUser({ name: "Owner" });
    storeId = seedStore({ ownerId: owner });
});

describe("aisle resolution", () => {
    /**
     * The normalization rule from CLAUDE.md: when an item sits in a section, the *section's*
     * aisle is authoritative and the item's own `aisleId` is NULL. The query has to reach the
     * aisle through the section, or every sectioned item renders as uncategorized.
     */
    it("resolves a sectioned item's aisle through its section", () => {
        const aisleId = seedAisle({ storeId, ownerId: owner, name: "Produce", sortOrder: 0 });
        const sectionId = seedSection({
            storeId,
            aisleId,
            ownerId: owner,
            name: "Fruit",
            sortOrder: 0,
        });
        const itemId = seedItem({ storeId, ownerId: owner, name: "Apples", sectionId });
        seedListItem({ storeId, ownerId: owner, storeItemId: itemId });

        const [row] = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(row.aisleId).toBe(aisleId);
        expect(row.aisleName).toBe("Produce");
        expect(row.sectionId).toBe(sectionId);
        expect(row.sectionName).toBe("Fruit");
    });

    it("uses the item's own aisle when it has no section", () => {
        const aisleId = seedAisle({ storeId, ownerId: owner, name: "Frozen" });
        const itemId = seedItem({ storeId, ownerId: owner, name: "Peas", aisleId });
        seedListItem({ storeId, ownerId: owner, storeItemId: itemId });

        const [row] = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(row.aisleId).toBe(aisleId);
        expect(row.sectionId).toBeNull();
    });

    it("returns an uncategorized item with no aisle or section", () => {
        const itemId = seedItem({ storeId, ownerId: owner, name: "Mystery" });
        seedListItem({ storeId, ownerId: owner, storeItemId: itemId });

        const [row] = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(row.aisleId).toBeNull();
        expect(row.sectionId).toBeNull();
        expect(row.itemName).toBe("Mystery");
    });

    // An "idea" has no store item at all, so every joined column must come back null rather than
    // dropping the row from the list.
    it("returns an idea that has no store item", () => {
        seedListItem({ storeId, ownerId: owner, storeItemId: null, isIdea: true, notes: "Snacks" });

        const rows = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(rows).toHaveLength(1);
        expect(rows[0].isIdea).toBe(true);
        expect(rows[0].itemName).toBeNull();
        expect(rows[0].notes).toBe("Snacks");
    });
});

describe("private items", () => {
    it("shows a private item to the person who added it", () => {
        seedListItem({ storeId, ownerId: owner, isPrivate: true, notes: "Gift" });

        const rows = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(rows).toHaveLength(1);
        expect(rows[0].isPrivate).toBe(true);
    });

    it("hides a private item from everyone else", () => {
        const other = seedUser({ name: "Other" });
        seedListItem({ storeId, ownerId: owner, isPrivate: true, notes: "Gift" });
        seedListItem({ storeId, ownerId: owner, notes: "Milk" });

        const rows = shoppingListRepo.getShoppingListItems(storeId, other);

        expect(rows.map((r) => r.notes)).toEqual(["Milk"]);
    });
});

describe("ordering", () => {
    it("orders by aisle, then section, then creation time", () => {
        const produce = seedAisle({ storeId, ownerId: owner, name: "Produce", sortOrder: 0 });
        const frozen = seedAisle({ storeId, ownerId: owner, name: "Frozen", sortOrder: 1 });
        const fruit = seedSection({
            storeId,
            aisleId: produce,
            ownerId: owner,
            name: "Fruit",
            sortOrder: 0,
        });
        const veg = seedSection({
            storeId,
            aisleId: produce,
            ownerId: owner,
            name: "Veg",
            sortOrder: 1,
        });

        const peas = seedItem({ storeId, ownerId: owner, name: "Peas", aisleId: frozen });
        const carrot = seedItem({ storeId, ownerId: owner, name: "Carrot", sectionId: veg });
        const apple = seedItem({ storeId, ownerId: owner, name: "Apple", sectionId: fruit });

        seedListItem({ storeId, ownerId: owner, storeItemId: peas });
        seedListItem({ storeId, ownerId: owner, storeItemId: carrot });
        seedListItem({ storeId, ownerId: owner, storeItemId: apple });

        const names = shoppingListRepo.getShoppingListItems(storeId, owner).map((r) => r.itemName);

        expect(names).toEqual(["Apple", "Carrot", "Peas"]);
    });

    // Uncategorized rows sort last via COALESCE(..., 999999) rather than being dropped by the
    // ORDER BY, which is what a plain `ORDER BY a.sortOrder` on a LEFT JOIN would risk.
    it("sorts uncategorized items after categorized ones", () => {
        const aisleId = seedAisle({ storeId, ownerId: owner, name: "Produce", sortOrder: 0 });
        const apple = seedItem({ storeId, ownerId: owner, name: "Apple", aisleId });
        const mystery = seedItem({ storeId, ownerId: owner, name: "Mystery" });

        seedListItem({ storeId, ownerId: owner, storeItemId: mystery });
        seedListItem({ storeId, ownerId: owner, storeItemId: apple });

        const names = shoppingListRepo.getShoppingListItems(storeId, owner).map((r) => r.itemName);

        expect(names).toEqual(["Apple", "Mystery"]);
    });
});

describe("boolean round-trip", () => {
    /**
     * Booleans are stored as `1` or NULL and never `0`, so the mapper has to turn NULL into
     * `false` rather than leaking null into a typed boolean field.
     */
    it("maps stored 1/NULL flags to true/false", () => {
        seedListItem({
            storeId,
            ownerId: owner,
            isChecked: true,
            isUnsure: true,
            notes: "Flagged",
        });

        const [row] = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(row.isChecked).toBe(true);
        expect(row.isUnsure).toBe(true);
        expect(row.isIdea).toBe(false);
    });

    it("scopes the list to one store", () => {
        const otherStore = seedStore({ ownerId: owner, name: "Other" });
        seedListItem({ storeId, ownerId: owner, notes: "Mine" });
        seedListItem({ storeId: otherStore, ownerId: owner, notes: "Theirs" });

        const rows = shoppingListRepo.getShoppingListItems(storeId, owner);

        expect(rows.map((r) => r.notes)).toEqual(["Mine"]);
    });
});
