import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { usePreference } from "../hooks/usePreference";
import { useSaveSecureApiKey, useSecureApiKey } from "../hooks/useSecureStorage";
import { useToast } from "../hooks/useToast";
import { settingsSchema, type SettingsFormData, type ThemeMode } from "./settingsSchema";

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

    // Fetch theme mode from preferences (suspends until loaded)
    const { value: themeModeValue, savePreference: saveThemeMode } = usePreference("theme_mode");

    // Save API key mutation
    const { mutateAsync: saveApiKey } = useSaveSecureApiKey();

    // Initialize form
    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            openaiApiKey: undefined,
            remoteApiUrl: undefined,
            themeMode: undefined,
        },
    });

    const { reset, formState } = form;
    const { isSubmitting } = formState;

    // Update form when preferences are loaded
    useEffect(() => {
        reset({
            openaiApiKey: apiKeyValue || undefined,
            remoteApiUrl: remoteApiUrlValue || undefined,
            themeMode: (themeModeValue as ThemeMode) || undefined,
        });
    }, [apiKeyValue, remoteApiUrlValue, themeModeValue, reset]);

    // Performs the actual save — takes validated form data, returns boolean success
    const performSave = useCallback(
        async (data: SettingsFormData): Promise<boolean> => {
            try {
                if (data.openaiApiKey && data.openaiApiKey.trim()) {
                    await saveApiKey(data.openaiApiKey.trim());
                }

                const urlToSave = data.remoteApiUrl?.trim() || null;
                await saveRemoteApiUrl(urlToSave);

                await saveThemeMode(data.themeMode ?? "system");

                showSuccess("Settings saved successfully");
                return true;
            } catch (error: unknown) {
                showError(error instanceof Error ? error.message : "Failed to save settings");
                console.error("Failed to save settings:", error);
                return false;
            }
        },
        [saveApiKey, saveRemoteApiUrl, saveThemeMode, showError, showSuccess]
    );

    return {
        form,
        performSave,
        isSubmitting,
    };
}
