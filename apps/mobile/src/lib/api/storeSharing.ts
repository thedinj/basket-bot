import type { NotificationCounts, Store } from "@basket-bot/core";
import { apiClient } from "./client";

/**
 * API methods for store household sharing and notifications
 */

// ========== Notifications ==========

export async function getNotificationCounts(): Promise<NotificationCounts> {
    return apiClient.get<NotificationCounts>("/api/notifications");
}

// ========== Store Household Sharing ==========

/**
 * Update a store's household association (share with household or make private)
 */
export async function updateStoreHousehold(
    storeId: string,
    householdId: string | null
): Promise<Store> {
    return apiClient.patch<Store>(`/api/stores/${storeId}/household`, { householdId });
}

/**
 * Update a store's visibility (hide/show in dropdowns)
 */
export async function updateStoreVisibility(storeId: string, isHidden: boolean): Promise<Store> {
    return apiClient.patch<Store>(`/api/stores/${storeId}/visibility`, { isHidden });
}
