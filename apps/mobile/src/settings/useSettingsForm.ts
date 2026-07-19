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

    // Fetch default meal plan slots from preferences (suspends until loaded)
    const { value: defaultMealPlanSlotsValue, savePreference: saveDefaultMealPlanSlots } =
        usePreference("default_meal_plan_slots");

    // Fetch default meal plan store from preferences (suspends until loaded)
    const { value: defaultMealPlanStoreValue, savePreference: saveDefaultMealPlanStore } =
        usePreference("default_meal_plan_store");

    // Save API key mutation
    const { mutateAsync: saveApiKey } = useSaveSecureApiKey();

    // Initialize form
    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            openaiApiKey: undefined,
            remoteApiUrl: undefined,
            themeMode: undefined,
            defaultMealPlanSlots: undefined,
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
            defaultMealPlanSlots: defaultMealPlanSlotsValue
                ? Number(defaultMealPlanSlotsValue)
                : undefined,
            defaultMealPlanStore: defaultMealPlanStoreValue || undefined,
        });
    }, [
        apiKeyValue,
        remoteApiUrlValue,
        themeModeValue,
        defaultMealPlanSlotsValue,
        defaultMealPlanStoreValue,
        reset,
    ]);

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

                await saveDefaultMealPlanSlots(
                    data.defaultMealPlanSlots != null ? String(data.defaultMealPlanSlots) : null
                );

                await saveDefaultMealPlanStore(data.defaultMealPlanStore || null);

                showSuccess("Settings saved successfully");
                return true;
            } catch (error: unknown) {
                showError(error instanceof Error ? error.message : "Failed to save settings");
                console.error("Failed to save settings:", error);
                return false;
            }
        },
        [saveApiKey, saveRemoteApiUrl, saveThemeMode, saveDefaultMealPlanSlots, saveDefaultMealPlanStore, showError, showSuccess]
    );

    return {
        form,
        performSave,
        isSubmitting,
    };
}
