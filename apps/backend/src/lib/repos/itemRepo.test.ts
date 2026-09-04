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
import { db } from "../db/db";
import * as itemRepo from "./itemRepo";

/**
 * Covers `mergeItemInto`, the branch added to stop renames from violating
 * `UNIQUE (storeId, nameNorm)`. It is the only place in the codebase where one row absorbs
 * another, it reconciles six fields by three different rules, and it destroys data — so the
 * reconciliation rules are worth pinning explicitly.
 */

let userId: string;
let storeId: string;

beforeEach(() => {
    resetDb();
    userId = seedUser();
    storeId = seedStore({ ownerId: userId });
});

const itemRow = (id: string) =>
    db.prepare(`SELECT * FROM StoreItem WHERE id = ?`).get(id) as
        | {
              id: string;
              aisleId: string | null;
              sectionId: string | null;
              usageCount: number;
              isFavorite: number;
              lastUsedAt: string | null;
          }
        | undefined;

describe("mergeItemInto", () => {
    it("moves the loser's shopping-list rows onto the winner and deletes the loser", () => {
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple" });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples" });
        const listItem = seedListItem({ storeId, ownerId: userId, storeItemId: loser });

        itemRepo.mergeItemInto(loser, winner);

        const row = db
            .prepare(`SELECT storeItemId FROM ShoppingListItem WHERE id = ?`)
            .get(listItem) as { storeItemId: string };
        expect(row.storeItemId).toBe(winner);
        expect(itemRow(loser)).toBeUndefined();
        expect(itemRow(winner)).toBeDefined();
    });

    it("sums usage counts", () => {
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple", usageCount: 3 });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples", usageCount: 4 });

        itemRepo.mergeItemInto(loser, winner);

        expect(itemRow(winner)!.usageCount).toBe(7);
    });

    // Favourite is a union: if either row was favourited, the survivor is.
    it("keeps the favourite flag if either side had it", () => {
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple", isFavorite: false });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples", isFavorite: true });

        itemRepo.mergeItemInto(loser, winner);

        expect(itemRow(winner)!.isFavorite).toBe(1);
    });

    it("keeps the winner's own location when it has one", () => {
        const winnerAisle = seedAisle({ storeId, ownerId: userId, name: "Produce" });
        const loserAisle = seedAisle({ storeId, ownerId: userId, name: "Frozen" });
        const winner = seedItem({
            storeId,
            ownerId: userId,
            name: "Apple",
            aisleId: winnerAisle,
        });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples", aisleId: loserAisle });

        itemRepo.mergeItemInto(loser, winner);

        expect(itemRow(winner)!.aisleId).toBe(winnerAisle);
    });

    it("adopts the loser's location when the winner has none", () => {
        const aisleId = seedAisle({ storeId, ownerId: userId, name: "Frozen" });
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple" });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples", aisleId });

        itemRepo.mergeItemInto(loser, winner);

        expect(itemRow(winner)!.aisleId).toBe(aisleId);
    });

    /**
     * The data-model invariant: a sectioned item's aisle is resolved through its section, so
     * `aisleId` must stay NULL. Adopting a loser's section has to respect that or the survivor
     * ends up with a contradictory location.
     */
    it("keeps aisle and section mutually exclusive when adopting a section", () => {
        const aisleId = seedAisle({ storeId, ownerId: userId, name: "Produce" });
        const sectionId = seedSection({ storeId, aisleId, ownerId: userId, name: "Fruit" });
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple" });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples", sectionId });

        itemRepo.mergeItemInto(loser, winner);

        const merged = itemRow(winner)!;
        expect(merged.sectionId).toBe(sectionId);
        expect(merged.aisleId).toBeNull();
    });

    it("keeps the most recent lastUsedAt", () => {
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple" });
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples" });
        db.prepare(`UPDATE StoreItem SET lastUsedAt = ? WHERE id = ?`).run(
            "2026-01-01T00:00:00.000Z",
            winner
        );
        db.prepare(`UPDATE StoreItem SET lastUsedAt = ? WHERE id = ?`).run(
            "2026-06-01T00:00:00.000Z",
            loser
        );

        itemRepo.mergeItemInto(loser, winner);

        expect(itemRow(winner)!.lastUsedAt).toBe("2026-06-01T00:00:00.000Z");
    });

    it("returns the winner untouched when either side is missing", () => {
        const winner = seedItem({ storeId, ownerId: userId, name: "Apple", usageCount: 2 });

        const result = itemRepo.mergeItemInto("does-not-exist", winner);

        expect(result?.id).toBe(winner);
        expect(itemRow(winner)!.usageCount).toBe(2);
    });

    // The merge is a single transaction; a failure part-way must not leave the loser's list rows
    // pointing at a winner that was never updated.
    it("leaves both rows intact when the winner does not exist", () => {
        const loser = seedItem({ storeId, ownerId: userId, name: "Apples" });

        itemRepo.mergeItemInto(loser, "does-not-exist");

        expect(itemRow(loser)).toBeDefined();
    });
});

describe("findItemByNameNorm", () => {
    it("finds an existing item by its normalized name, excluding the given id", () => {
        const apple = seedItem({ storeId, ownerId: userId, name: "Apple" });
        const other = seedItem({ storeId, ownerId: userId, name: "Bread" });

        expect(itemRepo.findItemByNameNorm(storeId, "apple", other)?.id).toBe(apple);
        // Excluding the row itself is what lets an item be "renamed" to its own current name.
        expect(itemRepo.findItemByNameNorm(storeId, "apple", apple)).toBeFalsy();
    });

    it("does not match across stores", () => {
        const otherStore = seedStore({ ownerId: userId, name: "Other" });
        seedItem({ storeId, ownerId: userId, name: "Apple" });

        expect(itemRepo.findItemByNameNorm(otherStore, "apple", "")).toBeFalsy();
    });

    // `normalizeItemName` does not singularize, so these are genuinely different items.
    it("treats singular and plural as different names", () => {
        seedItem({ storeId, ownerId: userId, name: "Apple" });

        expect(itemRepo.findItemByNameNorm(storeId, "apples", "")).toBeFalsy();
    });
});
