import type {
    Household,
    HouseholdMemberDetail,
    HouseholdRole,
    HouseholdWithMembers,
} from "@basket-bot/core";
import * as householdRepo from "../repos/householdRepo";

/**
 * Get all households a user is a member of
 */
export function getUserHouseholds(userId: string): Household[] {
    return householdRepo.getUserHouseholds(userId);
}

/**
 * Get household details with members (requires membership)
 */
export function getHouseholdWithMembers(householdId: string, userId: string): HouseholdWithMembers {
    // Verify user is a member
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    const household = householdRepo.getHouseholdWithMembers(householdId);
    if (!household) {
        throw new Error("NOT_FOUND: Household not found");
    }

    return household;
}

/**
 * Create a new household (user becomes owner)
 */
export function createHousehold(name: string, userId: string): Household {
    return householdRepo.createHousehold({ name, userId });
}

/**
 * Update household name (requires owner role)
 */
export function updateHousehold(householdId: string, name: string, userId: string): Household {
    const role = householdRepo.getUserRole(householdId, userId);

    if (!role) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    if (role !== "owner") {
        throw new Error("FORBIDDEN: Only owners can update household details");
    }

    const updated = householdRepo.updateHousehold({
        householdId,
        name,
        updatedById: userId,
    });

    if (!updated) {
        throw new Error("NOT_FOUND: Household not found");
    }

    return updated;
}

/**
 * Delete a household (requires owner role)
 */
export function deleteHousehold(householdId: string, userId: string): void {
    const role = householdRepo.getUserRole(householdId, userId);

    if (!role) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    if (role !== "owner") {
        throw new Error("FORBIDDEN: Only owners can delete the household");
    }

    const deleted = householdRepo.deleteHousehold(householdId);
    if (!deleted) {
        throw new Error("NOT_FOUND: Household not found");
    }
}

/**
 * Get household members (requires membership)
 */
export function getHouseholdMembers(householdId: string, userId: string): HouseholdMemberDetail[] {
    // Verify user is a member
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    return householdRepo.getHouseholdMembers(householdId);
}

/**
 * Update a member's role (requires owner role)
 * Cannot downgrade the last owner
 */
export function updateMemberRole(
    householdId: string,
    targetUserId: string,
    newRole: HouseholdRole,
    requestingUserId: string
): void {
    const requestingRole = householdRepo.getUserRole(householdId, requestingUserId);

    if (!requestingRole) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    if (requestingRole !== "owner") {
        throw new Error("FORBIDDEN: Only owners can change member roles");
    }

    // Check if target user is a member
    const targetRole = householdRepo.getUserRole(householdId, targetUserId);
    if (!targetRole) {
        throw new Error("NOT_FOUND: Target user is not a member of this household");
    }

    // Prevent downgrading the last owner
    if (targetRole === "owner" && newRole !== "owner") {
        const ownerCount = householdRepo.countOwners(householdId);
        if (ownerCount <= 1) {
            throw new Error(
                "FORBIDDEN: Cannot downgrade the last owner. Promote another member to owner first."
            );
        }
    }

    householdRepo.updateMemberRole({
        householdId,
        userId: targetUserId,
        role: newRole,
    });
}

/**
 * Remove a member from household (requires owner role or removing self)
 * Cannot remove the last owner
 */
export function removeMember(
    householdId: string,
    targetUserId: string,
    requestingUserId: string
): void {
    const requestingRole = householdRepo.getUserRole(householdId, requestingUserId);

    if (!requestingRole) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    // Allow users to remove themselves, otherwise require owner role
    const isSelf = targetUserId === requestingUserId;
    if (!isSelf && requestingRole !== "owner") {
        throw new Error("FORBIDDEN: Only owners can remove other members");
    }

    // Check if target user is a member
    const targetRole = householdRepo.getUserRole(householdId, targetUserId);
    if (!targetRole) {
        throw new Error("NOT_FOUND: Target user is not a member of this household");
    }

    // Prevent removing the last owner
    if (targetRole === "owner") {
        const ownerCount = householdRepo.countOwners(householdId);
        if (ownerCount <= 1) {
            throw new Error(
                "FORBIDDEN: Cannot remove the last owner. Transfer ownership first or delete the household."
            );
        }
    }

    householdRepo.removeMember(householdId, targetUserId);
}
