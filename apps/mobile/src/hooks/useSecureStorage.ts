import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { queryKeys } from "@/db/queryKeys";
import { llmApiKeyStorageKey, secureStorage } from "../utils/secureStorage";

/**
 * Generic hook for writing a value to secure storage with TanStack Query invalidation.
 *
 * @param key The secure storage key to update
 * @param setFn Async function that writes the value to secure storage
 * @returns TanStack Query mutation result
 */
export const useSaveSecureValue = <T>(key: string, setFn: (value: T) => Promise<void>) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: setFn,
        onSuccess: () => {
            // Invalidate the specific key to trigger refetch
            queryClient.invalidateQueries({
                queryKey: queryKeys.secureStorage(key),
            });
        },
    });
};

/**
 * Generic hook to get a value from secure storage (with Suspense).
 *
 * @param key The secure storage key to query
 * @param getFn Async function that retrieves the value from secure storage
 * @returns The stored value (or null if not found)
 */
export const useSecureValue = <T = string>(
    key: string,
    getFn: () => Promise<T | null>
): T | null => {
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.secureStorage(key),
        queryFn: getFn,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    });
    return data;
};

/**
 * Hook to get the stored API key for an LLM provider.
 *
 * @param providerId The configured provider's id
 * @returns The stored key, or null if the provider has none yet
 */
export const useLLMApiKey = (providerId: string): string | null =>
    useSecureValue(llmApiKeyStorageKey(providerId), () => secureStorage.getLLMApiKey(providerId));
