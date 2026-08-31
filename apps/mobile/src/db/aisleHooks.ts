import {
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import { useDatabase } from "./hooksShared";
import { queryKeys } from "./queryKeys";

// ============================================================================
// StoreAisle Query & Mutation Hooks
// ============================================================================

/**
 * Hook to fetch all aisles for a store
 */
export function useStoreAisles(storeId: string) {
    const database = useDatabase();
    return useTanstackQuery({
        queryKey: queryKeys.aisles.byStore(storeId),
        queryFn: () => database.getAislesByStore(storeId),
        enabled: !!storeId,
    });
}

/**
 * Hook to create a new aisle
 */
export function useCreateAisle() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ storeId, name }: { storeId: string; name: string }) =>
            database.insertAisle(storeId, name),
        meta: { operation: "create aisle" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aisles.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to update an aisle
 */
export function useUpdateAisle() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ storeId, id, name }: { id: string; name: string; storeId: string }) =>
            database.updateAisle(storeId, id, name),
        meta: { operation: "update aisle" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aisles.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.aisles.detail(variables.id),
            });
            // Invalidate store items since they display aisle names
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.byStore(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            // Invalidate shopping list items since they display aisle names
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to delete an aisle
 */
export function useDeleteAisle() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({ storeId, id }: { id: string; storeId: string }) =>
            database.deleteAisle(storeId, id),
        meta: { operation: "delete aisle" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aisles.byStore(variables.storeId),
            });
            // Invalidate store items and shopping list since aisle was deleted
            queryClient.invalidateQueries({
                queryKey: queryKeys.items.withDetails(variables.storeId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}

/**
 * Hook to reorder aisles
 */
export function useReorderAisles() {
    const database = useDatabase();
    const queryClient = useQueryClient();

    return useTanstackMutation({
        mutationFn: ({
            storeId,
            updates,
        }: {
            storeId: string;
            updates: Array<{ id: string; sortOrder: number }>;
        }) => database.reorderAisles(storeId, updates),
        meta: { operation: "reorder aisles" },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.aisles.byStore(variables.storeId),
            });
            // Invalidate shopping list items since they display items in aisle order
            queryClient.invalidateQueries({
                queryKey: queryKeys.shoppingListItems.byStore(variables.storeId),
            });
        },
    });
}
