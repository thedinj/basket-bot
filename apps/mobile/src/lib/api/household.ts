import type {
    Household,
    HouseholdInvitation,
    HouseholdMemberDetail,
    HouseholdWithMembers,
    InvitationDetail,
} from "@basket-bot/core";
import { apiClient } from "./client";

/**
 * Household API methods
 */
export const householdApi = {
    /**
     * Get all households the current user is a member of
     */
    async getUserHouseholds(): Promise<Household[]> {
        const response = await apiClient.get<{ households: Household[] }>("/api/households");
        return response.households;
    },

    /**
     * Get household details with members
     */
    async getHouseholdWithMembers(householdId: string): Promise<HouseholdWithMembers> {
        const response = await apiClient.get<{ household: HouseholdWithMembers }>(
            `/api/households/${householdId}`
        );
        return response.household;
    },

    /**
     * Create a new household
     */
    async createHousehold(name: string): Promise<Household> {
        const response = await apiClient.post<{ household: Household }>("/api/households", {
            name,
        });
        return response.household;
    },

    /**
     * Update household name
     */
    async updateHousehold(householdId: string, name: string): Promise<Household> {
        const response = await apiClient.put<{ household: Household }>(
            `/api/households/${householdId}`,
            { name }
        );
        return response.household;
    },

    /**
     * Delete a household
     */
    async deleteHousehold(householdId: string): Promise<void> {
        await apiClient.delete(`/api/households/${householdId}`);
    },

    /**
     * Get household members
     */
    async getHouseholdMembers(householdId: string): Promise<HouseholdMemberDetail[]> {
        const response = await apiClient.get<{ members: HouseholdMemberDetail[] }>(
            `/api/households/${householdId}/members`
        );
        return response.members;
    },

    /**
     * Create an invitation to join the household
     */
    async createInvitation(householdId: string, email: string): Promise<HouseholdInvitation> {
        const response = await apiClient.post<{ invitation: HouseholdInvitation }>(
            `/api/households/${householdId}/members`,
            { email }
        );
        return response.invitation;
    },

    /**
     * Remove a member from the household
     */
    async removeMember(householdId: string, userId: string): Promise<void> {
        await apiClient.delete(`/api/households/${householdId}/members/${userId}`);
    },

    /**
     * Get pending invitations for a household
     */
    async getHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]> {
        const response = await apiClient.get<{ invitations: HouseholdInvitation[] }>(
            `/api/households/${householdId}/invitations`
        );
        return response.invitations;
    },

    /**
     * Cancel/retract a pending invitation
     */
    async cancelInvitation(householdId: string, invitationId: string): Promise<void> {
        await apiClient.delete(`/api/households/${householdId}/invitations/${invitationId}`);
    },
};

/**
 * Invitation API methods
 */
export const invitationApi = {
    /**
     * Get pending invitations for the current user
     */
    async getUserPendingInvitations(): Promise<InvitationDetail[]> {
        const response = await apiClient.get<{ invitations: InvitationDetail[] }>(
            "/api/invitations"
        );
        return response.invitations;
    },

    /**
     * Accept an invitation
     */
    async acceptInvitation(token: string): Promise<void> {
        await apiClient.post(`/api/invitations/${token}/accept`, {});
    },

    /**
     * Decline an invitation
     */
    async declineInvitation(token: string): Promise<void> {
        await apiClient.post(`/api/invitations/${token}/decline`, {});
    },
};
