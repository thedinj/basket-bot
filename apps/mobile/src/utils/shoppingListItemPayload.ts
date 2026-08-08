import type { ShoppingListItemInput, ShoppingListItemWithDetails } from "@basket-bot/core";

/**
 * Builds a full upsert payload from an existing shopping list item, with `overrides` layered
 * on top. `upsertShoppingListItem` is a full replace on every optional field (not a merge) —
 * any field left out of a payload gets reset to its default rather than left alone. Always
 * build updates through this helper instead of a hand-picked field subset, so a targeted
 * change (e.g. clearing `isUnsure`) can't silently drop `isPrivate`, `snoozedUntil`, etc.
 */
export const toUpsertPayload = (
    item: ShoppingListItemWithDetails,
    overrides: Partial<ShoppingListItemInput> = {}
): ShoppingListItemInput => ({
    id: item.id,
    storeId: item.storeId,
    storeItemId: item.storeItemId,
    qty: item.qty,
    unitId: item.unitId,
    notes: item.notes,
    isChecked: item.isChecked,
    isIdea: item.isIdea,
    isSample: item.isSample,
    isUnsure: item.isUnsure,
    isPrivate: item.isPrivate,
    snoozedUntil: item.snoozedUntil,
    ...overrides,
});
