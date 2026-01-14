import { Preferences } from "@capacitor/preferences";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Generic hook for managing Capacitor Preferences.
 * Uses useSuspenseQuery to avoid isLoading pattern.
 * 
 * @param key - The preference key to store/retrieve
 * @returns Object with current value and setter function
 */
export const usePreference = (key: string) => {
    const queryClient = useQueryClient();

    // Load preference with Suspense
    const { data: value } = useSuspenseQuery({
        queryKey: ["preference", key],
        queryFn: async () => {
            const { value } = await Preferences.get({ key });
            return value;
        },
    });

    // Save preference mutation
    const { mutateAsync: savePreference } = useMutation({
        mutationFn: async (newValue: string | null) => {
            if (newValue !== null) {
                await Preferences.set({ key, value: newValue });
            } else {
                await Preferences.remove({ key });
            }
            return newValue;
        },
        onSuccess: (newValue) => {
            // Update cache immediately
            queryClient.setQueryData(["preference", key], newValue);
        },
    });

    return { value, savePreference };
};
