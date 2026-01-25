import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { usePreference } from "../hooks/usePreference";
import { useSaveSecureApiKey, useSecureApiKey } from "../hooks/useSecureStorage";
import { useToast } from "../hooks/useToast";
import { settingsSchema, type SettingsFormData } from "./settingsSchema";

/**
 * Custom hook to manage settings form state and operations
 */
export function useSettingsForm() {
    const { showSuccess, showError } = useToast();

    // Fetch API key from secure storage (suspends until loaded)
    const apiKeyValue = useSecureApiKey();

    // Fetch remote API URL from preferences (suspends until loaded)
    const { value: remoteApiUrlValue, savePreference: saveRemoteApiUrl } =
        usePreference("remote_api_url");

    // Save API key mutation
    const { mutateAsync: saveApiKey } = useSaveSecureApiKey();

    // Initialize form
    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            openaiApiKey: undefined,
            remoteApiUrl: undefined,
        },
    });

    const { reset, handleSubmit, formState } = form;
    const { isSubmitting } = formState;

    // Update form when API key or remote URL is loaded
    useEffect(() => {
        reset({
            openaiApiKey: apiKeyValue || undefined,
            remoteApiUrl: remoteApiUrlValue || undefined,
        });
    }, [apiKeyValue, remoteApiUrlValue, reset]);

    // Handle form submission
    const onSubmit = handleSubmit(async (data: SettingsFormData) => {
        try {
            // Save API key to secure storage (if provided)
            if (data.openaiApiKey && data.openaiApiKey.trim()) {
                await saveApiKey(data.openaiApiKey.trim());
            }

            // Save remote API URL to preferences
            const urlToSave = data.remoteApiUrl?.trim() || null;
            await saveRemoteApiUrl(urlToSave);

            // Show success message
            showSuccess("Settings saved successfully");
            return true;
        } catch (error) {
            // Show error toast
            showError(error instanceof Error ? error.message : "Failed to save settings");
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
