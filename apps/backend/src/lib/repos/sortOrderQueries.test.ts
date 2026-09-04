import { beforeEach, describe, expect, it } from "vitest";
import { seedAisle, seedStore, seedUser } from "../../../test/support/fixtures";
import { resetDb } from "../../../test/support/resetDb";
import { db } from "../db/db";
import { applySortOrders, readMaxSortOrder } from "./sortOrderQueries";

/**
 * Ordering bugs are a recurring theme in this repo's history, and the trap is nearly always the
 * boundary case — an empty scope, or a `MAX()` over no rows — rather than the ordering itself.
 */

let userId: string;
let storeId: string;

const maxStmt = () =>
    db.prepare(`SELECT MAX(sortOrder) as maxOrder FROM StoreAisle WHERE storeId = ?`);
const updateStmt = () => db.prepare(`UPDATE StoreAisle SET sortOrder = ? WHERE id = ?`);

const orderOf = (id: string): number =>
    (db.prepare(`SELECT sortOrder FROM StoreAisle WHERE id = ?`).get(id) as { sortOrder: number })
        .sortOrder;

beforeEach(() => {
    resetDb();
    userId = seedUser();
    storeId = seedStore({ ownerId: userId });
});

describe("readMaxSortOrder", () => {
    /**
     * -1, not 0. Callers append with `readMaxSortOrder(...) + 1`, so an empty scope has to return
     * -1 for the first row to land at 0. Returning 0 here would silently start every fresh store
     * at 1 and leave a permanent gap.
     */
    it("returns -1 for an empty scope so the first append lands at 0", () => {
        expect(readMaxSortOrder(maxStmt(), storeId)).toBe(-1);
    });

    it("returns the highest existing order", () => {
        seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: 0 });
        seedAisle({ storeId, ownerId: userId, name: "B", sortOrder: 7 });
        seedAisle({ storeId, ownerId: userId, name: "C", sortOrder: 3 });

        expect(readMaxSortOrder(maxStmt(), storeId)).toBe(7);
    });

    it("is scoped to the store", () => {
        const otherStore = seedStore({ ownerId: userId, name: "Other" });
        seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: 9 });

        expect(readMaxSortOrder(maxStmt(), otherStore)).toBe(-1);
    });

    it("handles negative orders", () => {
        seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: -5 });

        expect(readMaxSortOrder(maxStmt(), storeId)).toBe(-5);
    });
});

describe("applySortOrders", () => {
    it("applies every update", () => {
        const a = seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: 0 });
        const b = seedAisle({ storeId, ownerId: userId, name: "B", sortOrder: 1 });

        applySortOrders(updateStmt(), [
            { id: a, sortOrder: 1 },
            { id: b, sortOrder: 0 },
        ]);

        expect(orderOf(a)).toBe(1);
        expect(orderOf(b)).toBe(0);
    });

    it("accepts an empty batch", () => {
        expect(() => applySortOrders(updateStmt(), [])).not.toThrow();
    });

    it("tolerates gaps in the resulting sequence", () => {
        const a = seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: 0 });

        applySortOrders(updateStmt(), [{ id: a, sortOrder: 50 }]);

        expect(orderOf(a)).toBe(50);
        expect(readMaxSortOrder(maxStmt(), storeId)).toBe(50);
    });

    it("ignores ids that do not exist", () => {
        const a = seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: 0 });

        applySortOrders(updateStmt(), [
            { id: a, sortOrder: 2 },
            { id: "missing", sortOrder: 3 },
        ]);

        expect(orderOf(a)).toBe(2);
    });

    /**
     * All-or-nothing. A half-applied reorder is worse than a rejected one: the list would come
     * back with two rows claiming the same position and no way to tell which is right.
     */
    it("rolls the whole batch back when one update fails", () => {
        const a = seedAisle({ storeId, ownerId: userId, name: "A", sortOrder: 0 });
        const b = seedAisle({ storeId, ownerId: userId, name: "B", sortOrder: 1 });

        expect(() =>
            applySortOrders(updateStmt(), [
                { id: a, sortOrder: 5 },
                // NOT NULL on sortOrder — this row throws, and must take the first one with it.
                { id: b, sortOrder: null as unknown as number },
            ])
        ).toThrow();

        expect(orderOf(a)).toBe(0);
        expect(orderOf(b)).toBe(1);
    });
});
