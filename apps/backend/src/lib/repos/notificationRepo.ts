import type { NotificationCounts } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Get notification counts for a user
 */
export function getNotificationCounts(email: string): NotificationCounts {
    // Count pending household invitations
    const householdInvitationsRow = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM HouseholdInvitation
             WHERE invitedEmail = ? COLLATE NOCASE AND status = 'pending'`
        )
        .get(email.toLowerCase()) as { count: number };

    const householdInvitations = householdInvitationsRow.count;

    return {
        householdInvitations,
    };
}
