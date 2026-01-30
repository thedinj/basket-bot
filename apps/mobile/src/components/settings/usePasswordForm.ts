import { changePasswordRequestSchema, type ChangePasswordRequest } from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "../../hooks/useToast";
import { apiClient } from "../../lib/api/client";

/**
 * Custom hook to manage password change form state and operations
 */
export function usePasswordForm() {
    const { showError } = useToast();

    // Password change form
    const passwordForm = useForm<ChangePasswordRequest>({
        resolver: zodResolver(changePasswordRequestSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const { isSubmitting: isSubmittingPassword } = passwordForm.formState;

    // Handle password change
    const onSubmitPassword = async (data: ChangePasswordRequest): Promise<boolean> => {
        try {
            await apiClient.patch("/api/user/password", data);

            // Reset password form
            passwordForm.reset({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });

            return true;
        } catch (error) {
            showError(error instanceof Error ? error.message : "Failed to change password");
            console.error("Failed to change password:", error);
            return false;
        }
    };

    return {
        passwordForm,
        onSubmitPassword,
        isSubmittingPassword,
    };
}
