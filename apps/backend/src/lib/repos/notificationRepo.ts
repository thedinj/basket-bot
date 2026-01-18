import type { NotificationCounts } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Get notification counts for a user
 */
export function getNotificationCounts(email: string): NotificationCounts {
    // Count pending store invitations
    const storeInvitationsRow = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM StoreInvitation
             WHERE invitedEmail = ? COLLATE NOCASE AND status = 'pending'`
        )
        .get(email.toLowerCase()) as { count: number };

    // Count pending household invitations
    const householdInvitationsRow = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM HouseholdInvitation
             WHERE invitedEmail = ? COLLATE NOCASE AND status = 'pending'`
        )
        .get(email.toLowerCase()) as { count: number };

    const storeInvitations = storeInvitationsRow.count;
    const householdInvitations = householdInvitationsRow.count;

    return {
        storeInvitations,
        householdInvitations,
    };
}
