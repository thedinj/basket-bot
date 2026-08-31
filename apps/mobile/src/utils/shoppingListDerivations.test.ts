import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeTripProgress, isPendingUnsure, partitionBySnooze } from "./shoppingListDerivations";

// Frozen "today" so snooze boundaries are deterministic regardless of when the suite runs.
const TODAY = new Date("2026-03-15T09:00:00.000Z");

/** Local YYYY-MM-DD offset from the frozen today — matches how isCurrentlySnoozed compares dates. */
const dayOffset = (days: number): string => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + days);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${iso}T00:00:00.000Z`;
};

const makeItem = (
    overrides: Partial<ShoppingListItemWithDetails> = {}
): ShoppingListItemWithDetails => ({
    id: "00000000-0000-4000-8000-000000000001",
    storeId: "00000000-0000-4000-8000-0000000000ff",
    storeItemId: null,
    qty: null,
    unitId: null,
    notes: null,
    isChecked: false,
    checkedAt: null,
    checkedBy: null,
    checkedUpdatedAt: null,
    isSample: null,
    isUnsure: null,
    isIdea: false,
    isPrivate: null,
    snoozedUntil: null,
    createdById: "00000000-0000-4000-8000-00000000000a",
    updatedById: "00000000-0000-4000-8000-00000000000a",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    itemName: "Item",
    unitAbbreviation: null,
    sectionId: null,
    aisleId: null,
    sectionName: null,
    sectionSortOrder: null,
    aisleName: null,
    aisleSortOrder: null,
    checkedByName: null,
    isFavorite: null,
    createdByName: null,
    updatedByName: null,
    storeItemCreatedByName: null,
    storeItemUpdatedByName: null,
    storeItemCreatedAt: null,
    storeItemUpdatedAt: null,
    ...overrides,
});

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("partitionBySnooze", () => {
    it("hides snoozed items from activeItems when showSnoozed is false", () => {
        const items = [
            makeItem({ id: "a", snoozedUntil: null }),
            makeItem({ id: "b", snoozedUntil: dayOffset(5) }),
        ];

        const { activeItems } = partitionBySnooze(items, false);

        expect(activeItems.map((i) => i.id)).toEqual(["a"]);
    });

    it("includes snoozed items in activeItems when showSnoozed is true", () => {
        const items = [
            makeItem({ id: "a", snoozedUntil: null }),
            makeItem({ id: "b", snoozedUntil: dayOffset(5) }),
        ];

        const { activeItems } = partitionBySnooze(items, true);

        expect(activeItems.map((i) => i.id)).toEqual(["a", "b"]);
    });

    // The regression that repeatedly broke the header: the count must describe the whole list,
    // not the visible subset. If it tracked activeItems, revealing snoozed items would drop the
    // count to 0 and unmount the very toggle used to reveal them.
    it("reports the same snoozed count regardless of showSnoozed", () => {
        const items = [
            makeItem({ id: "a", snoozedUntil: null }),
            makeItem({ id: "b", snoozedUntil: dayOffset(5) }),
            makeItem({ id: "c", snoozedUntil: dayOffset(9) }),
        ];

        expect(partitionBySnooze(items, false).currentlySnoozedItemCount).toBe(2);
        expect(partitionBySnooze(items, true).currentlySnoozedItemCount).toBe(2);
    });

    it("treats an expired snooze as not snoozed", () => {
        const items = [makeItem({ snoozedUntil: dayOffset(-1) })];

        const { currentlySnoozedItemCount, activeItems } = partitionBySnooze(items, false);

        expect(currentlySnoozedItemCount).toBe(0);
        expect(activeItems).toHaveLength(1);
    });

    it("treats a snooze expiring today as visible, and tomorrow as still snoozed", () => {
        const today = partitionBySnooze([makeItem({ snoozedUntil: dayOffset(0) })], false);
        const tomorrow = partitionBySnooze([makeItem({ snoozedUntil: dayOffset(1) })], false);

        expect(today.currentlySnoozedItemCount).toBe(0);
        expect(tomorrow.currentlySnoozedItemCount).toBe(1);
    });

    it("handles an empty list", () => {
        expect(partitionBySnooze([], false)).toEqual({
            currentlySnoozedItemCount: 0,
            activeItems: [],
        });
    });
});

describe("computeTripProgress", () => {
    it("returns null for an empty list so no progress line renders", () => {
        expect(computeTripProgress([])).toBeNull();
    });

    it("returns the checked fraction", () => {
        const items = [
            makeItem({ id: "a", isChecked: true }),
            makeItem({ id: "b", isChecked: false }),
            makeItem({ id: "c", isChecked: false }),
            makeItem({ id: "d", isChecked: true }),
        ];

        expect(computeTripProgress(items)).toBe(0.5);
    });

    it("returns 1 when everything is checked", () => {
        const items = [makeItem({ isChecked: true }), makeItem({ isChecked: true })];

        expect(computeTripProgress(items)).toBe(1);
    });

    it("returns 0 when nothing is checked", () => {
        expect(computeTripProgress([makeItem({ isChecked: false })])).toBe(0);
    });
});

describe("isPendingUnsure", () => {
    it("matches an unchecked, unsure item", () => {
        expect(isPendingUnsure(makeItem({ isChecked: false, isUnsure: true }))).toBe(true);
    });

    it("rejects an unsure item once it's been checked off", () => {
        // Picking it up settles the question, whatever the flag still says.
        expect(isPendingUnsure(makeItem({ isChecked: true, isUnsure: true }))).toBe(false);
    });

    it("rejects items that were never flagged unsure", () => {
        expect(isPendingUnsure(makeItem({ isChecked: false, isUnsure: false }))).toBe(false);
    });

    it("treats a null flag as not unsure, and returns a real boolean", () => {
        // isUnsure is nullable in the schema; a raw `&&` would leak null into `.filter` callers.
        expect(isPendingUnsure(makeItem({ isChecked: false, isUnsure: null }))).toBe(false);
    });
});
