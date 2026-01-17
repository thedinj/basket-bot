import type { HouseholdInvitation, HouseholdRole, InvitationDetail } from "@basket-bot/core";
import * as householdRepo from "../repos/householdRepo";
import * as invitationRepo from "../repos/invitationRepo";

/**
 * Create an invitation to join a household
 * Requires owner or editor role
 */
export function createInvitation(
    householdId: string,
    invitedEmail: string,
    role: HouseholdRole,
    invitedById: string
): HouseholdInvitation {
    // Verify household exists
    const household = householdRepo.getHouseholdById(householdId);
    if (!household) {
        throw new Error("NOT_FOUND: Household not found");
    }

    // Verify inviter is a member with appropriate permissions
    const inviterRole = householdRepo.getUserRole(householdId, invitedById);
    if (!inviterRole) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    if (inviterRole !== "owner" && inviterRole !== "editor") {
        throw new Error("FORBIDDEN: Only owners and editors can invite members");
    }

    // Check if email is already invited or is already a member
    if (invitationRepo.isEmailInvitedOrMember(householdId, invitedEmail)) {
        throw new Error("CONFLICT: This email is already a member or has a pending invitation");
    }

    return invitationRepo.createInvitation({
        householdId,
        invitedEmail,
        invitedById,
        role,
    });
}

/**
 * Get pending invitations for the current user
 */
export function getUserPendingInvitations(userEmail: string): InvitationDetail[] {
    return invitationRepo.getUserPendingInvitations(userEmail);
}

/**
 * Accept an invitation (adds user to household)
 */
export function acceptInvitation(token: string, userId: string, userEmail: string): void {
    const invitation = invitationRepo.getInvitationByToken(token);

    if (!invitation) {
        throw new Error("NOT_FOUND: Invitation not found");
    }

    if (invitation.status !== "pending") {
        throw new Error("CONFLICT: Invitation has already been processed");
    }

    // Verify the invitation is for this user's email (case-insensitive)
    if (invitation.invitedEmail.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error("FORBIDDEN: This invitation is not for your email address");
    }

    // Check if user is already a member (edge case)
    if (householdRepo.userIsMember(invitation.householdId, userId)) {
        // Delete invitation since they're already a member
        invitationRepo.deleteInvitation(invitation.id);
        return;
    }

    // Add user to household then delete the invitation
    try {
        householdRepo.addMember({
            householdId: invitation.householdId,
            userId,
            role: invitation.role,
        });

        // Delete invitation after successful acceptance
        invitationRepo.deleteInvitation(invitation.id);
    } catch (error) {
        // If adding member fails, don't delete invitation
        throw error;
    }
}

/**
 * Decline an invitation
 */
export function declineInvitation(token: string, userEmail: string): void {
    const invitation = invitationRepo.getInvitationByToken(token);

    if (!invitation) {
        throw new Error("NOT_FOUND: Invitation not found");
    }

    if (invitation.status !== "pending") {
        throw new Error("CONFLICT: Invitation has already been processed");
    }

    // Verify the invitation is for this user's email (case-insensitive)
    if (invitation.invitedEmail.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error("FORBIDDEN: This invitation is not for your email address");
    }

    // Delete invitation when declined
    invitationRepo.deleteInvitation(invitation.id);
}

/**
 * Cancel/delete an invitation (requires owner or editor who created it)
 */
export function deleteInvitation(invitationId: string, householdId: string, userId: string): void {
    // Verify user has permission
    const role = householdRepo.getUserRole(householdId, userId);
    if (!role) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    if (role !== "owner" && role !== "editor") {
        throw new Error("FORBIDDEN: Only owners and editors can cancel invitations");
    }

    const deleted = invitationRepo.deleteInvitation(invitationId);
    if (!deleted) {
        throw new Error("NOT_FOUND: Invitation not found");
    }
}

/**
 * Get pending invitations for a household (requires membership)
 */
export function getHouseholdPendingInvitations(
    householdId: string,
    userId: string
): HouseholdInvitation[] {
    // Verify user is a member
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    return invitationRepo.getHouseholdPendingInvitations(householdId);
}
