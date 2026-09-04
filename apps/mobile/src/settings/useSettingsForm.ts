import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { usePreference } from "../hooks/usePreference";
import { useToast } from "../hooks/useToast";
import { useLLMConfig } from "../llm/config/useLLMConfig";
import { resolveBaseUrl } from "../llm/config/llmConfig";
import { buildLLMSavePlan } from "./llmSettings";
import { settingsSchema, type SettingsFormData, type ThemeMode } from "./settingsSchema";

/**
 * Custom hook to manage settings form state and operations
 */
export function useSettingsForm() {
    const { showSuccess, showError } = useToast();

    // LLM provider config + the active provider's key (suspends until loaded)
    const { config: llmConfig, provider, apiKey, saveConfig, saveApiKeyFor } = useLLMConfig();

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

    // Initialize form
    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            llmProviderId: undefined,
            llmBaseUrl: undefined,
            llmApiKey: undefined,
            llmModelFast: undefined,
            llmModelSmart: undefined,
            llmModelVision: undefined,
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
            llmProviderId: provider.id,
            llmBaseUrl: provider.baseUrlEditable ? resolveBaseUrl(llmConfig) : undefined,
            llmApiKey: apiKey || undefined,
            llmModelFast: llmConfig.models.fast,
            llmModelSmart: llmConfig.models.smart,
            llmModelVision: llmConfig.models.vision,
            remoteApiUrl: remoteApiUrlValue || undefined,
            themeMode: (themeModeValue as ThemeMode) || undefined,
            defaultMealPlanSlots: defaultMealPlanSlotsValue
                ? Number(defaultMealPlanSlotsValue)
                : undefined,
            defaultMealPlanStore: defaultMealPlanStoreValue || undefined,
        });
    }, [
        llmConfig,
        provider,
        apiKey,
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
                const llmPlan = buildLLMSavePlan(data, llmConfig);

                await saveConfig(llmPlan.config);

                // The plan names the provider slot explicitly, so a submit that switches
                // provider and enters a key files the key under the new provider.
                if (llmPlan.apiKey) {
                    await saveApiKeyFor(llmPlan.apiKey.providerId, llmPlan.apiKey.value);
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
        [
            llmConfig,
            saveConfig,
            saveApiKeyFor,
            saveRemoteApiUrl,
            saveThemeMode,
            saveDefaultMealPlanSlots,
            saveDefaultMealPlanStore,
            showError,
            showSuccess,
        ]
    );

    return {
        form,
        performSave,
        isSubmitting,
    };
}
