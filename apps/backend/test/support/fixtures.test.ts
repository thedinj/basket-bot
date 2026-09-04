import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db/db";
import { resetDb } from "./resetDb";
import { seedAisle, seedItem, seedListItem, seedSection, seedStore, seedUser } from "./fixtures";

describe("fixtures", () => {
    beforeEach(() => resetDb());

    it("seeds a full Store -> Aisle -> Section -> Item hierarchy", () => {
        const userId = seedUser();
        const storeId = seedStore({ ownerId: userId });
        const aisleId = seedAisle({ storeId, ownerId: userId, name: "Produce" });
        const sectionId = seedSection({ storeId, aisleId, ownerId: userId, name: "Fruit" });
        const itemId = seedItem({ storeId, sectionId, ownerId: userId, name: "Apples" });

        const item = db.prepare(`SELECT * FROM StoreItem WHERE id = ?`).get(itemId) as {
            nameNorm: string;
            aisleId: string | null;
            sectionId: string;
        };
        expect(item.nameNorm).toBe("apples");
        expect(item.aisleId).toBeNull();
        expect(item.sectionId).toBe(sectionId);
    });

    it("refuses an item with both an aisle and a section", () => {
        const userId = seedUser();
        const storeId = seedStore({ ownerId: userId });
        const aisleId = seedAisle({ storeId, ownerId: userId });
        const sectionId = seedSection({ storeId, aisleId, ownerId: userId });

        expect(() => seedItem({ storeId, aisleId, sectionId, ownerId: userId })).toThrow(
            /not both/
        );
    });

    it("stores booleans as 1 or NULL, never 0", () => {
        const userId = seedUser();
        const storeId = seedStore({ ownerId: userId });
        const listItemId = seedListItem({ storeId, ownerId: userId, isChecked: true });

        const row = db
            .prepare(`SELECT isChecked, isUnsure FROM ShoppingListItem WHERE id = ?`)
            .get(listItemId) as { isChecked: number | null; isUnsure: number | null };
        expect(row.isChecked).toBe(1);
        expect(row.isUnsure).toBeNull();
    });

    it("resetDb empties application tables but keeps reference data", () => {
        const userId = seedUser();
        seedStore({ ownerId: userId });
        const unitsBefore = db.prepare(`SELECT COUNT(*) as n FROM QuantityUnit`).get() as {
            n: number;
        };

        resetDb();

        const stores = db.prepare(`SELECT COUNT(*) as n FROM Store`).get() as { n: number };
        const unitsAfter = db.prepare(`SELECT COUNT(*) as n FROM QuantityUnit`).get() as {
            n: number;
        };
        expect(stores.n).toBe(0);
        expect(unitsAfter.n).toBe(unitsBefore.n);
    });
});
