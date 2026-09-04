import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { describe, expect, it } from "vitest";
import { toUpsertPayload } from "./shoppingListItemPayload";

const makeItem = (
    overrides: Partial<ShoppingListItemWithDetails> = {}
): ShoppingListItemWithDetails =>
    ({
        id: "00000000-0000-4000-8000-000000000001",
        storeId: "00000000-0000-4000-8000-0000000000ff",
        storeItemId: "00000000-0000-4000-8000-000000000002",
        qty: 3,
        unitId: "00000000-0000-4000-8000-000000000003",
        notes: "ripe ones",
        isChecked: false,
        checkedAt: null,
        checkedBy: null,
        checkedUpdatedAt: null,
        isSample: true,
        isUnsure: true,
        isIdea: false,
        isPrivate: true,
        snoozedUntil: "2026-04-01T00:00:00.000Z",
        createdById: "00000000-0000-4000-8000-00000000000a",
        updatedById: "00000000-0000-4000-8000-00000000000a",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        itemName: "Apples",
        unitAbbreviation: "lb",
        ...overrides,
    }) as ShoppingListItemWithDetails;

describe("toUpsertPayload", () => {
    // The bug this helper exists to prevent: `upsertShoppingListItem` is a full replace, so a
    // targeted change built from a hand-picked field subset silently resets everything omitted.
    it("preserves every optional field when overriding just one", () => {
        const item = makeItem();
        const payload = toUpsertPayload(item, { isUnsure: null });

        expect(payload.isUnsure).toBeNull();
        expect(payload).toMatchObject({
            isPrivate: true,
            isSample: true,
            isIdea: false,
            snoozedUntil: "2026-04-01T00:00:00.000Z",
            qty: 3,
            unitId: "00000000-0000-4000-8000-000000000003",
            notes: "ripe ones",
            isChecked: false,
            storeItemId: "00000000-0000-4000-8000-000000000002",
        });
    });

    it("carries identity fields through unchanged", () => {
        const payload = toUpsertPayload(makeItem());
        expect(payload.id).toBe("00000000-0000-4000-8000-000000000001");
        expect(payload.storeId).toBe("00000000-0000-4000-8000-0000000000ff");
    });

    it("preserves falsy values rather than dropping them", () => {
        const payload = toUpsertPayload(
            makeItem({ qty: 0, notes: "", isPrivate: null, snoozedUntil: null })
        );
        expect(payload.qty).toBe(0);
        expect(payload.notes).toBe("");
        expect(payload.isPrivate).toBeNull();
        expect(payload.snoozedUntil).toBeNull();
    });

    it("applies multiple overrides at once", () => {
        const payload = toUpsertPayload(makeItem(), { isChecked: true, qty: 10 });
        expect(payload.isChecked).toBe(true);
        expect(payload.qty).toBe(10);
        expect(payload.isPrivate).toBe(true);
    });

    /**
     * Structural guard. Adding a field to `ShoppingListItemInput` without threading it through
     * this helper reintroduces exactly the clobbering bug the helper exists to prevent, and no
     * value-level assertion above would notice. Update this list deliberately.
     */
    it("emits exactly the documented payload shape", () => {
        expect(Object.keys(toUpsertPayload(makeItem())).sort()).toEqual(
            [
                "id",
                "storeId",
                "storeItemId",
                "qty",
                "unitId",
                "notes",
                "isChecked",
                "isIdea",
                "isSample",
                "isUnsure",
                "isPrivate",
                "snoozedUntil",
            ].sort()
        );
    });
});
