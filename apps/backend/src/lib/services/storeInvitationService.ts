import type {
    StoreCollaboratorRole,
    StoreInvitation,
    StoreInvitationDetail,
} from "@basket-bot/core";
import * as storeInvitationRepo from "../repos/storeInvitationRepo";
import * as storeRepo from "../repos/storeRepo";

/**
 * Create an invitation to join a store as a collaborator
 * Requires owner or editor role (both can invite)
 */
export function createStoreInvitation(
    storeId: string,
    invitedEmail: string,
    role: StoreCollaboratorRole,
    invitedById: string
): StoreInvitation {
    // Verify store exists
    const store = storeRepo.getStoreById(storeId);
    if (!store) {
        throw new Error("NOT_FOUND: Store not found");
    }

    // Verify inviter has access to this store
    const inviterRole = storeRepo.getUserStoreRole(invitedById, storeId);
    if (!inviterRole) {
        throw new Error("FORBIDDEN: User does not have access to this store");
    }

    // Both owners and editors can invite (per requirements)
    if (inviterRole !== "owner" && inviterRole !== "editor") {
        throw new Error("FORBIDDEN: Only owners and editors can invite collaborators");
    }

    // Check if email is already invited or is already a collaborator
    if (storeInvitationRepo.isEmailStoreInvitedOrCollaborator(storeId, invitedEmail)) {
        throw new Error(
            "CONFLICT: This email is already a collaborator or has a pending invitation"
        );
    }

    return storeInvitationRepo.createStoreInvitation({
        storeId,
        invitedEmail,
        invitedById,
        role,
    });
}

/**
 * Get pending store invitations for the current user
 */
export function getUserPendingStoreInvitations(userEmail: string): StoreInvitationDetail[] {
    return storeInvitationRepo.getUserPendingStoreInvitations(userEmail);
}

/**
 * Accept a store invitation (adds user as collaborator)
 */
export function acceptStoreInvitation(token: string, userId: string, userEmail: string): void {
    const invitation = storeInvitationRepo.getStoreInvitationByToken(token);

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

    // Check if user is already a collaborator (edge case)
    if (storeRepo.userHasAccessToStore(userId, invitation.storeId)) {
        // Delete invitation since they're already a collaborator
        storeInvitationRepo.deleteStoreInvitation(invitation.id);
        return;
    }

    // Add user as collaborator then delete the invitation
    try {
        storeRepo.addStoreCollaborator({
            storeId: invitation.storeId,
            userId,
            role: invitation.role,
        });

        // Delete invitation after successful acceptance
        storeInvitationRepo.deleteStoreInvitation(invitation.id);
    } catch (error) {
        // If adding collaborator fails, don't delete invitation
        throw error;
    }
}

/**
 * Decline a store invitation
 */
export function declineStoreInvitation(token: string, userEmail: string): void {
    const invitation = storeInvitationRepo.getStoreInvitationByToken(token);

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
    storeInvitationRepo.deleteStoreInvitation(invitation.id);
}

/**
 * Get pending invitations for a store (for owners to see outgoing invitations)
 */
export function getStoreInvitations(storeId: string, userId: string): StoreInvitationDetail[] {
    // Verify store exists
    const store = storeRepo.getStoreById(storeId);
    if (!store) {
        throw new Error("NOT_FOUND: Store not found");
    }

    // Verify user has access to this store
    const userRole = storeRepo.getUserStoreRole(userId, storeId);
    if (!userRole) {
        throw new Error("FORBIDDEN: User does not have access to this store");
    }

    // Only owners and editors can view invitations (consistent with who can send them)
    if (userRole !== "owner" && userRole !== "editor") {
        throw new Error("FORBIDDEN: Only owners and editors can view store invitations");
    }

    return storeInvitationRepo.getStoreInvitationsWithDetails(storeId);
}

/**
 * Retract (delete) a pending store invitation
 * Only the original inviter or store owner can retract
 */
export function retractStoreInvitation(invitationId: string, userId: string): void {
    const invitation = storeInvitationRepo.getStoreInvitationById(invitationId);

    if (!invitation) {
        throw new Error("NOT_FOUND: Invitation not found or already accepted");
    }

    if (invitation.status !== "pending") {
        throw new Error("CONFLICT: Invitation has already been processed");
    }

    // Verify user has access to this store
    const userRole = storeRepo.getUserStoreRole(userId, invitation.storeId);
    if (!userRole) {
        throw new Error("FORBIDDEN: User does not have access to this store");
    }

    // Only the original inviter or store owner can retract
    const isOriginalInviter = invitation.invitedById === userId;
    const isOwner = userRole === "owner";

    if (!isOriginalInviter && !isOwner) {
        throw new Error(
            "FORBIDDEN: Only the original inviter or store owner can retract this invitation"
        );
    }

    // Delete the invitation
    storeInvitationRepo.deleteStoreInvitation(invitation.id);
}
