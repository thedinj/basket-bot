import { ApiError } from "@/lib/api/client";
import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import { useToast } from "../hooks/useToast";
import { householdApi, invitationApi } from "../lib/api/household";
import { queryKeys } from "./queryKeys";

// ============================================================================
// Household Management Hooks
// ============================================================================

/**
 * Hook to get all households the current user is a member of
 */
export function useHouseholds() {
    return useTanstackQuery({
        queryKey: queryKeys.households(),
        queryFn: householdApi.getUserHouseholds,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status) {
                // Don't retry 4xx errors except timeout/rate-limit
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to get household details with members
 */
export function useHouseholdDetail(householdId: string | null) {
    return useTanstackQuery({
        queryKey: queryKeys.household.detail(householdId),
        queryFn: () => {
            if (!householdId) throw new Error("Household ID is required");
            return householdApi.getHouseholdWithMembers(householdId);
        },
        enabled: !!householdId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status === 404) {
                // Don't retry 404s - household was deleted
                return false;
            }
            if (error instanceof ApiError && error.status) {
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to get pending invitations for the current user
 */
export function usePendingInvitations() {
    return useTanstackQuery({
        queryKey: queryKeys.invitations(),
        queryFn: invitationApi.getUserPendingInvitations,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status) {
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to create a new household
 */
export function useCreateHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (name: string) => householdApi.createHousehold(name),
        meta: { operation: "create household" },
        onSuccess: (household) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.households() });
            showSuccess(`Household "${household.name}" created!`);
        },
    });
}

/**
 * Hook to update a household's name
 */
export function useUpdateHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; name: string }) =>
            householdApi.updateHousehold(params.householdId, params.name),
        meta: { operation: "update household" },
        onSuccess: (household) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.household.detail(household.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.households() });
            showSuccess("Household updated!");
        },
    });
}

/**
 * Hook to delete a household
 */
export function useDeleteHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (householdId: string) => householdApi.deleteHousehold(householdId),
        meta: { operation: "delete household" },
        onSuccess: (_, householdId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.household.detail(householdId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.households() });
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() }); // Stores may be affected
            showSuccess("Household deleted");
        },
    });
}

/**
 * Hook to invite a member to a household
 */
export function useInviteMember() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; email: string }) =>
            householdApi.createInvitation(params.householdId, params.email),
        meta: { operation: "invite member" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.household.detail(variables.householdId),
            });
            showSuccess(`Invitation sent to ${variables.email}`);
        },
    });
}

/**
 * Hook to remove a member from a household
 */
export function useRemoveMember() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; userId: string }) =>
            householdApi.removeMember(params.householdId, params.userId),
        meta: { operation: "remove member" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.household.detail(variables.householdId),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.households() });
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
            showSuccess("Member removed");
        },
    });
}

/**
 * Hook to accept a household invitation
 */
export function useAcceptInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (token: string) => invitationApi.acceptInvitation(token),
        meta: { operation: "accept invitation" },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invitations() });
            queryClient.invalidateQueries({ queryKey: queryKeys.households() });
            // Accepting clears a pending invite → refresh the notification badge count.
            queryClient.invalidateQueries({ queryKey: queryKeys.notificationCounts() });
            showSuccess("Invitation accepted!");
        },
    });
}

/**
 * Hook to decline a household invitation
 */
export function useDeclineInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (token: string) => invitationApi.declineInvitation(token),
        meta: { operation: "decline invitation" },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invitations() });
            // Declining clears a pending invite → refresh the notification badge count.
            queryClient.invalidateQueries({ queryKey: queryKeys.notificationCounts() });
            showSuccess("Invitation declined");
        },
    });
}

/**
 * Hook to get pending invitations for a household
 */
export function useHouseholdInvitations(householdId: string | null) {
    return useTanstackQuery({
        queryKey: queryKeys.household.invitations(householdId),
        queryFn: () => {
            if (!householdId) throw new Error("Household ID is required");
            return householdApi.getHouseholdInvitations(householdId);
        },
        enabled: !!householdId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: (failureCount, error: unknown) => {
            if (error instanceof ApiError && error.status) {
                if (error.status >= 400 && error.status < 500) {
                    return error.status === 408 || error.status === 429;
                }
            }
            return failureCount < 3;
        },
    });
}

/**
 * Hook to cancel/retract a pending invitation
 */
export function useCancelInvitation() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { householdId: string; invitationId: string }) =>
            householdApi.cancelInvitation(params.householdId, params.invitationId),
        meta: { operation: "cancel invitation" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.household.invitations(variables.householdId),
            });
            showSuccess("Invitation cancelled");
        },
    });
}
