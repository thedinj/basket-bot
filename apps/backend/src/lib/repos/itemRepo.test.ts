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

/**
 * Covers the orphan predicate behind the "Obliterate Unused" action. It hard-deletes rows with
 * no undo, so every sparing condition is pinned here — especially the ones the client cannot
 * see for itself (another member's private list row) and the one that looks like a bug but is
 * not (a sectioned item legitimately carries a NULL `aisleId`).
 */
describe("orphan items", () => {
    it("returns an item that is uncategorized, unfavorited, and on no list", () => {
        const orphan = seedItem({ storeId, ownerId: userId, name: "Zucchini" });

        expect(itemRepo.getOrphanItems(storeId).map((i) => i.id)).toEqual([orphan]);
        expect(itemRepo.deleteOrphanItems(storeId, [orphan])).toBe(1);
        expect(itemRow(orphan)).toBeUndefined();
    });

    it("orders by normalized name", () => {
        seedItem({ storeId, ownerId: userId, name: "Banana" });
        seedItem({ storeId, ownerId: userId, name: "apple" });

        expect(itemRepo.getOrphanItems(storeId).map((i) => i.name)).toEqual(["apple", "Banana"]);
    });

    it("spares a favorited item", () => {
        const fav = seedItem({ storeId, ownerId: userId, name: "Coffee", isFavorite: true });

        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [fav])).toBe(0);
        expect(itemRow(fav)).toBeDefined();
    });

    it("spares a hidden item", () => {
        const hidden = seedItem({ storeId, ownerId: userId, name: "Ghost", isHidden: true });

        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [hidden])).toBe(0);
    });

    it("spares an item placed in an aisle", () => {
        const aisleId = seedAisle({ storeId, ownerId: userId, name: "Produce" });
        const placed = seedItem({ storeId, ownerId: userId, name: "Kale", aisleId });

        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [placed])).toBe(0);
    });

    // A sectioned item's own aisleId column is NULL by design — the section resolves it. The
    // predicate must therefore check sectionId too, or every sectioned item reads as orphaned.
    it("spares an item placed in a section despite its NULL aisleId", () => {
        const aisleId = seedAisle({ storeId, ownerId: userId, name: "Produce" });
        const sectionId = seedSection({ storeId, aisleId, ownerId: userId, name: "Greens" });
        const placed = seedItem({ storeId, ownerId: userId, name: "Kale", sectionId });

        expect(itemRow(placed)?.aisleId).toBeNull();
        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [placed])).toBe(0);
    });

    it.each([
        ["unchecked", { isChecked: false }],
        ["checked", { isChecked: true }],
        ["unsure", { isUnsure: true }],
        ["an idea row", { isIdea: true }],
        ["snoozed", { snoozedUntil: "2999-01-01T00:00:00.000Z" }],
    ])("spares an item on a %s shopping-list row", (_label, listFlags) => {
        const listed = seedItem({ storeId, ownerId: userId, name: "Milk" });
        seedListItem({ storeId, storeItemId: listed, ownerId: userId, ...listFlags });

        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [listed])).toBe(0);
    });

    // The deciding case for computing this server-side: the requesting client can never see
    // this row, so a client-side predicate would happily delete the item out from under them.
    it("spares an item on another member's private list row", () => {
        const other = seedUser({ name: "Housemate" });
        const listed = seedItem({ storeId, ownerId: userId, name: "Birthday Candles" });
        seedListItem({ storeId, storeItemId: listed, ownerId: other, isPrivate: true });

        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [listed])).toBe(0);
    });

    it("ignores ids belonging to another store", () => {
        const otherStore = seedStore({ ownerId: userId, name: "Other" });
        const elsewhere = seedItem({ storeId: otherStore, ownerId: userId, name: "Zucchini" });

        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
        expect(itemRepo.deleteOrphanItems(storeId, [elsewhere])).toBe(0);
        expect(itemRow(elsewhere)).toBeDefined();
    });

    // The race guard: the preview is a snapshot, so the delete re-applies the predicate.
    it("skips an id that stopped qualifying after the preview", () => {
        const stillOrphan = seedItem({ storeId, ownerId: userId, name: "Napkins" });
        const claimed = seedItem({ storeId, ownerId: userId, name: "Milk" });
        const previewed = itemRepo.getOrphanItems(storeId).map((i) => i.id);
        expect(previewed).toHaveLength(2);

        seedListItem({ storeId, storeItemId: claimed, ownerId: userId });

        expect(itemRepo.deleteOrphanItems(storeId, previewed)).toBe(1);
        expect(itemRow(claimed)).toBeDefined();
        expect(itemRow(stillOrphan)).toBeUndefined();
    });

    it("deletes nothing for an empty id list", () => {
        seedItem({ storeId, ownerId: userId, name: "Napkins" });

        expect(itemRepo.deleteOrphanItems(storeId, [])).toBe(0);
        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(1);
    });

    // Exercises the chunking loop in deleteOrphanItems (500 ids per statement).
    it("deletes more ids than fit in a single statement", () => {
        const ids = Array.from({ length: 1200 }, (_, i) =>
            seedItem({ storeId, ownerId: userId, name: `Item ${i}` })
        );

        expect(itemRepo.deleteOrphanItems(storeId, ids)).toBe(1200);
        expect(itemRepo.getOrphanItems(storeId)).toHaveLength(0);
    });
});
