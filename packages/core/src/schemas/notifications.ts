import { z } from "zod";

/**
 * General notifications schema for polling and badge counts
 * Extensible for future notification types (households, etc.)
 */

export const notificationCountsSchema = z.object({
    storeInvitations: z.number().int().min(0),
    householdInvitations: z.number().int().min(0),
});

export type NotificationCounts = z.infer<typeof notificationCountsSchema>;
