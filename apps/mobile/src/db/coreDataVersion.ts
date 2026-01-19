import { Preferences } from "@capacitor/preferences";
import type { QueryClient } from "@tanstack/react-query";

const CORE_DATA_VERSION_KEY = "coreDataVersion";

/**
 * Get the current app version from package.json
 * In production, this should be read from the build process
 */
const getAppVersion = (): string => {
    // This will be replaced by the build process with the actual version
    return "0.0.1";
};

/**
 * Get the stored core data version from secure storage
 */
const getStoredCoreDataVersion = async (): Promise<string | null> => {
    const { value } = await Preferences.get({ key: CORE_DATA_VERSION_KEY });
    return value;
};

/**
 * Store the current core data version
 */
const setStoredCoreDataVersion = async (version: string): Promise<void> => {
    await Preferences.set({ key: CORE_DATA_VERSION_KEY, value: version });
};

/**
 * Check if core data cache should be invalidated due to app version change
 * If the app version has changed, invalidate static table caches and update stored version
 *
 * @param queryClient - TanStack Query client instance
 * @returns true if cache was invalidated, false otherwise
 */
export const checkAndInvalidateCoreDataCache = async (
    queryClient: QueryClient
): Promise<boolean> => {
    const currentVersion = getAppVersion();
    const storedVersion = await getStoredCoreDataVersion();

    // If version has changed, invalidate core data cache
    if (storedVersion !== currentVersion) {
        console.log(
            `App version changed from ${storedVersion ?? "unknown"} to ${currentVersion}. Invalidating core data cache.`
        );

        // Invalidate static table caches
        await queryClient.invalidateQueries({ queryKey: ["quantityUnits"] });
        await queryClient.invalidateQueries({ queryKey: ["appSettings"] });

        // Update stored version
        await setStoredCoreDataVersion(currentVersion);

        return true;
    }

    return false;
};

/**
 * Force invalidate core data cache
 * Useful for debugging or manual refresh functionality
 *
 * Example usage:
 * ```typescript
 * import { forceClearCoreDataCache } from '@/db/coreDataVersion';
 *
 * const handleRefresh = async () => {
 *   const queryClient = useQueryClient();
 *   await forceClearCoreDataCache(queryClient);
 * };
 * ```
 */
export const forceClearCoreDataCache = async (queryClient: QueryClient): Promise<void> => {
    console.log("Force clearing core data cache");

    // Invalidate static table caches
    await queryClient.invalidateQueries({ queryKey: ["quantityUnits"] });
    await queryClient.invalidateQueries({ queryKey: ["appSettings"] });

    // Clear stored version to force re-check
    await Preferences.remove({ key: CORE_DATA_VERSION_KEY });
};
