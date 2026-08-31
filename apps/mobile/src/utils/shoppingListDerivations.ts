import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { isCurrentlySnoozed } from "./dateUtils";

export interface SnoozePartition {
    /**
     * Count of items whose snooze is still in effect, always measured against the *full* list
     * rather than `activeItems`. The header's snoozed-items toggle is gated on this, so counting
     * the visible items instead would make the toggle vanish the moment it succeeded in
     * revealing them.
     */
    currentlySnoozedItemCount: number;
    /** The items to actually render: everything when `showSnoozed`, otherwise the un-snoozed ones. */
    activeItems: ShoppingListItemWithDetails[];
}

/**
 * Split a store's shopping list into "what to show" and "how many are snoozed", in one pass.
 *
 * Pure on purpose: both the list body and the header chrome derive from this, so the two can
 * never disagree about how many items are snoozed, and the rules stay testable without
 * rendering Ionic components.
 */
export const partitionBySnooze = (
    items: ShoppingListItemWithDetails[],
    showSnoozed: boolean
): SnoozePartition => {
    const awake = items.filter((item) => !isCurrentlySnoozed(item.snoozedUntil));

    return {
        currentlySnoozedItemCount: items.length - awake.length,
        activeItems: showSnoozed ? items : awake,
    };
};

/**
 * An item still awaiting a yes/no on whether it's actually needed.
 *
 * Checked items are excluded on purpose: once you've picked something up, the question is
 * settled regardless of what the flag still says. Every "unsure" count and filter in the app
 * must agree on that, so they all route through here.
 */
export const isPendingUnsure = (item: ShoppingListItemWithDetails): boolean =>
    !item.isChecked && item.isUnsure === true;

/**
 * Fraction of the trip that's checked off, or `null` when there's nothing to shop for (the
 * header renders no progress line rather than an empty 0% one).
 */
export const computeTripProgress = (activeItems: ShoppingListItemWithDetails[]): number | null => {
    if (activeItems.length === 0) return null;

    const checkedCount = activeItems.filter((item) => item.isChecked).length;
    return checkedCount / activeItems.length;
};
