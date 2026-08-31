import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { useQueryClient } from "@tanstack/react-query";
import { use, useCallback, useMemo } from "react";
import { DatabaseContext } from "./context";
import { checkAndInvalidateCoreDataCache } from "./coreDataVersion";
import { queryKeys } from "./queryKeys";
import { type Database } from "./types";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sort items alphabetically by a key extraction function (case-insensitive)
 */
function sortByKey<T>(items: T[], getKey: (item: T) => string): T[] {
    return items.sort((a, b) =>
        getKey(a).localeCompare(getKey(b), undefined, { sensitivity: "base" })
    );
}

/**
 * Sort items alphabetically by name property (case-insensitive)
 */
export function sortItemsByName<T extends { name: string }>(items: T[]): T[] {
    return sortByKey(items, (item) => item.name);
}

/**
 * Sort shopping list items alphabetically by display name (case-insensitive)
 * Uses itemName for regular items, notes for ideas
 */
export function sortNamedItems(
    items: ShoppingListItemWithDetails[]
): ShoppingListItemWithDetails[] {
    return sortByKey(items, (item) => item.itemName || item.notes || "");
}

// ============================================================================
// Core Data Caching Configuration
// ============================================================================

/**
 * Cache times for static/shared tables that rarely or never change
 * - QuantityUnit: Static reference data seeded at app initialization
 * - AppSetting: Infrequently modified application settings
 */
export const CORE_DATA_CACHE = {
    /** Static reference data - never changes, cache indefinitely */
    STATIC: {
        staleTime: Infinity,
        gcTime: Infinity,
    },
    /** Infrequently modified settings - cache for 5 minutes */
    SETTINGS: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    },
} as const;

/**
 * Hook to get database instance directly
 */
export function useDatabase(): Database {
    const context = use(DatabaseContext);
    if (!context) {
        throw new Error("useDatabase must be used within a DatabaseProvider");
    }
    return context.database;
}

/**
 * Hook to preload static/core data tables on app initialization
 * Call this hook early in the app lifecycle to populate the cache
 * with static reference data (quantity units), settings, stores, and store structure
 *
 * Also checks for app version changes and invalidates cache if needed
 */
export const usePreloadCoreData = () => {
    const database = useDatabase();
    const queryClient = useQueryClient();

    const prefetchCoreData = useCallback(async () => {
        // Check if app version changed and invalidate cache if needed
        await checkAndInvalidateCoreDataCache(queryClient);

        // Prefetch quantity units and stores in parallel
        try {
            const [, stores] = await Promise.all([
                queryClient.prefetchQuery({
                    queryKey: queryKeys.quantityUnits(),
                    queryFn: () => database.loadAllQuantityUnits(),
                    staleTime: CORE_DATA_CACHE.STATIC.staleTime,
                }),
                queryClient.fetchQuery({
                    queryKey: queryKeys.stores.all(),
                    queryFn: () => database.loadAllStores(),
                    staleTime: 30 * 60 * 1000, // 30 minutes
                }),
            ]);

            // Prefetch aisles and sections for each store (30 minute cache)
            if (stores && stores.length > 0) {
                await Promise.all(
                    stores.flatMap((store) => [
                        queryClient.prefetchQuery({
                            queryKey: queryKeys.aisles.byStore(store.id),
                            queryFn: () => database.getAislesByStore(store.id),
                            staleTime: 30 * 60 * 1000, // 30 minutes
                        }),
                        queryClient.prefetchQuery({
                            queryKey: queryKeys.sections.byStore(store.id),
                            queryFn: () => database.getSectionsByStore(store.id),
                            staleTime: 30 * 60 * 1000, // 30 minutes
                        }),
                    ])
                );
            }
        } catch (error) {
            console.error("[usePreloadCoreData] Failed to prefetch quantities and stores:", error);
            // Don't block app initialization on preload failures
        }
    }, [database, queryClient]);

    return useMemo(() => ({ prefetchCoreData }), [prefetchCoreData]);
};
