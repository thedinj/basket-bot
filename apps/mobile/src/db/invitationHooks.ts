import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import { useToast } from "../hooks/useToast";
import * as storeSharingApi from "../lib/api/storeSharing";
import { queryKeys } from "./queryKeys";

// ============================================================================
// Store Invitations and Collaborators
// ============================================================================

/**
 * Hook to fetch notification counts
 */
export function useNotificationCounts() {
    return useTanstackQuery({
        queryKey: queryKeys.notificationCounts(),
        queryFn: storeSharingApi.getNotificationCounts,
        staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh
    });
}

/**
 * Hook to update a store's household association
 */
export function useUpdateStoreHousehold() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; householdId: string | null }) =>
            storeSharingApi.updateStoreHousehold(params.storeId, params.householdId),
        meta: { operation: "update store sharing" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.detail(variables.storeId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
            if (variables.householdId) {
                showSuccess("Store shared with household!");
            } else {
                showSuccess("Store is now private");
            }
        },
    });
}

/**
 * Hook to update a store's visibility (hide/show)
 */
export function useUpdateStoreVisibility() {
    const queryClient = useQueryClient();
    const { showSuccess } = useToast();

    return useTanstackMutation({
        mutationFn: (params: { storeId: string; isHidden: boolean }) =>
            storeSharingApi.updateStoreVisibility(params.storeId, params.isHidden),
        meta: { operation: "update store visibility" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.detail(variables.storeId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.stores.all() });
            if (variables.isHidden) {
                showSuccess("Store hidden from lists");
            } else {
                showSuccess("Store is now visible");
            }
        },
    });
}
