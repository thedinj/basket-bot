import type { Store } from "@basket-bot/core";

export interface VisibleStoresOptions {
    /**
     * Keep this store even when it's hidden. Pickers that display a current selection pass the
     * selected id, so hiding a store doesn't make the one you're looking at vanish from its own
     * list.
     */
    keepStoreId?: string | null;
    /**
     * Drop these stores outright, hidden or not. "Move this item elsewhere" pickers pass the
     * item's current store so it isn't offered as a destination.
     */
    excludeStoreIds?: readonly string[];
}

/**
 * The stores a picker should offer: visible ones, plus/minus the caller's exceptions.
 *
 * Hiding a store is a display preference rather than a delete, so nearly every store list in the
 * app filters on `isHidden` — and a few need to bend the rule. Keeping the rule and its two
 * exceptions in one place stops those variants drifting apart.
 *
 * Takes `undefined` because most callers pass a TanStack `data` that hasn't landed yet.
 */
export const filterVisibleStores = (
    stores: Store[] | undefined,
    { keepStoreId, excludeStoreIds }: VisibleStoresOptions = {}
): Store[] => {
    if (!stores) return [];

    return stores.filter((store) => {
        if (excludeStoreIds?.includes(store.id)) return false;
        if (keepStoreId && store.id === keepStoreId) return true;
        return !store.isHidden;
    });
};
