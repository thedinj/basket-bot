import { type UpdateProfileRequest, updateProfileRequestSchema, type User } from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { apiClient } from "../../lib/api/client";

/**
 * Custom hook to manage profile editing form state and operations
 */
export function useProfileForm() {
    const { user } = useAuth();
    const { showError } = useToast();

    // Profile form (name only)
    const profileForm = useForm<UpdateProfileRequest>({
        resolver: zodResolver(updateProfileRequestSchema),
        defaultValues: {
            name: "",
        },
    });

    const { isSubmitting: isSubmittingProfile } = profileForm.formState;

    // Initialize profile form with user data
    useEffect(() => {
        if (user) {
            profileForm.reset({
                name: user.name,
            });
        }
    }, [user, profileForm]);

    // Handle profile update
    const onSubmitProfile = async (data: UpdateProfileRequest): Promise<boolean> => {
        try {
            await apiClient.patch<User>("/api/user/profile", data);

            // Force a fresh login to reload user data
            // This is simpler than managing user state updates across contexts
            // The user's session remains valid, they just get fresh data
            window.location.reload();

            return true;
        } catch (error) {
            showError(error instanceof Error ? error.message : "Failed to update profile");
            console.error("Failed to update profile:", error);
            return false;
        }
    };

    return {
        profileForm,
        onSubmitProfile,
        isSubmittingProfile,
    };
}
