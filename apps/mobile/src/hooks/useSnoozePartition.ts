import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { useMemo } from "react";
import { partitionBySnooze, type SnoozePartition } from "../utils/shoppingListDerivations";
import { useMidnightUpdate } from "./useMidnightUpdate";

/**
 * A store's shopping list split into "what to show" and "how many are snoozed", kept correct
 * across midnight.
 *
 * Both the header chrome (`ShoppingListShell`) and the list body (`ShoppingListBody`) need this
 * partition, and they read the same TanStack cache entry to get it. Keeping the derivation in one
 * hook is what stops them disagreeing about how many items are snoozed — they previously held
 * byte-identical copies of this block, which is exactly the setup that produced the vanishing
 * snoozed-items toggle.
 */
export const useSnoozePartition = (
    items: ShoppingListItemWithDetails[],
    showSnoozed: boolean
): SnoozePartition => {
    // Only arm the midnight timer when something can actually expire.
    const hasItemsWithSnoozeUntil = useMemo(
        () => items.some((item) => item.snoozedUntil !== null),
        [items]
    );
    const currentDate = useMidnightUpdate(hasItemsWithSnoozeUntil);

    // `currentDate` is a dep so snooze expiry re-evaluates at midnight, even though
    // `partitionBySnooze` doesn't take it as an argument.
    return useMemo(
        () => partitionBySnooze(items, showSnoozed),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [items, showSnoozed, currentDate]
    );
};
