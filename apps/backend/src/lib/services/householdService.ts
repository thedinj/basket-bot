import type { Household, HouseholdMemberDetail, HouseholdWithMembers } from "@basket-bot/core";
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
 * Create a new household (user becomes a member)
 */
export function createHousehold(name: string, userId: string): Household {
    return householdRepo.createHousehold({ name, userId });
}

/**
 * Update household name (requires membership)
 */
export function updateHousehold(householdId: string, name: string, userId: string): Household {
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new Error("FORBIDDEN: User is not a member of this household");
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
 * Delete a household (requires membership)
 */
export function deleteHousehold(householdId: string, userId: string): void {
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new Error("FORBIDDEN: User is not a member of this household");
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
 * Remove a member from household (requires membership)
 * Deletes the household when the last member is removed
 */
export function removeMember(
    householdId: string,
    targetUserId: string,
    requestingUserId: string
): void {
    if (!householdRepo.userIsMember(householdId, requestingUserId)) {
        throw new Error("FORBIDDEN: User is not a member of this household");
    }

    // Check if target user is a member
    if (!householdRepo.userIsMember(householdId, targetUserId)) {
        throw new Error("NOT_FOUND: Target user is not a member of this household");
    }

    householdRepo.removeMember(householdId, targetUserId);

    const remainingMembers = householdRepo.countMembers(householdId);
    if (remainingMembers === 0) {
        householdRepo.deleteHousehold(householdId);
    }
}
