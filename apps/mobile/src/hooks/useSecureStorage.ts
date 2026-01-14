import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { secureStorage } from "../utils/secureStorage";

/**
 * Generic hook for writing a value to secure storage with TanStack Query invalidation.
 *
 * @param key The secure storage key to update
 * @param setFn Async function that writes the value to secure storage
 * @returns TanStack Query mutation result
 */
export const useSaveSecureValue = <T>(
    key: string,
    setFn: (value: T) => Promise<void>
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: setFn,
        onSuccess: () => {
            // Invalidate the specific key to trigger refetch
            queryClient.invalidateQueries({
                queryKey: ["secure-storage", key],
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
        queryKey: ["secure-storage", key],
        queryFn: getFn,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    });
    return data;
};

/**
 * Hook to get the OpenAI API key from secure storage.
 * Uses useSecureValue with the correct key and getter.
 */
export const useSecureApiKey = (): string | null =>
    useSecureValue("openai_api_key", () => secureStorage.getApiKey());

/**
 * Hook to save the OpenAI API key to secure storage.
 * Only works on native platforms (Android Keystore).
 * Web platform throws error (must use .env file instead).
 *
 * @returns TanStack Query mutation for saving the API key
 */
export const useSaveSecureApiKey = () => {
    return useSaveSecureValue("openai_api_key", (value: string) =>
        secureStorage.setApiKey(value)
    );
};
