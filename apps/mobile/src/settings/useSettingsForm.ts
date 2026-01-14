import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "../hooks/useToast";
import {
    useSecureApiKey,
    useSaveSecureApiKey,
} from "../hooks/useSecureStorage";
import { settingsSchema, type SettingsFormData } from "./settingsSchema";

/**
 * Custom hook to manage settings form state and operations
 */
export function useSettingsForm() {
    const { showSuccess, showError } = useToast();

    // Fetch API key from secure storage (suspends until loaded)
    const apiKeyValue = useSecureApiKey();

    // Save API key mutation
    const { mutateAsync: saveApiKey } = useSaveSecureApiKey();

    // Initialize form
    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            openaiApiKey: undefined,
        },
    });

    const { reset, handleSubmit, formState } = form;
    const { isSubmitting } = formState;

    // Update form when API key is loaded
    useEffect(() => {
        reset({
            openaiApiKey: apiKeyValue || undefined,
        });
    }, [apiKeyValue, reset]);

    // Handle form submission
    const onSubmit = handleSubmit(async (data: SettingsFormData) => {
        try {
            // Save API key to secure storage (if provided)
            if (data.openaiApiKey && data.openaiApiKey.trim()) {
                await saveApiKey(data.openaiApiKey.trim());
            }

            // Show success message
            showSuccess("Settings saved successfully");
            return true;
        } catch (error) {
            // Show error toast
            showError(
                error instanceof Error
                    ? error.message
                    : "Failed to save settings"
            );
            console.error("Failed to save settings:", error);
        }
        return false;
    });

    return {
        form,
        onSubmit,
        isSubmitting,
    };
}
