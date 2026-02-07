import { z } from "zod";

/**
 * General notifications schema for polling and badge counts
 * Extensible for future notification types
 */

export const notificationCountsSchema = z.object({
    householdInvitations: z.number().int().min(0),
});

export type NotificationCounts = z.infer<typeof notificationCountsSchema>;
