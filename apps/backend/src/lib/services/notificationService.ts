import type { NotificationCounts } from "@basket-bot/core";
import * as notificationRepo from "../repos/notificationRepo";

/**
 * Get notification counts for the current user
 */
export function getNotificationCounts(userEmail: string): NotificationCounts {
    return notificationRepo.getNotificationCounts(userEmail);
}
