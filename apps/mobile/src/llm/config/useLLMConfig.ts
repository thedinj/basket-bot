/**
 * Reads the active LLM configuration and its provider's API key.
 *
 * Built on the existing generic `usePreference` / secure-storage hooks, so the config
 * participates in the same suspense + cache invalidation model as every other setting.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "@/db/queryKeys";
import { usePreference } from "../../hooks/usePreference";
import { useLLMApiKey } from "../../hooks/useSecureStorage";
import { llmApiKeyStorageKey, secureStorage } from "../../utils/secureStorage";
import { getProviderOrDefault } from "../providers/registry";
import type { LLMProviderDescriptor } from "../providers/types";
import {
    LLM_CONFIG_PREFERENCE_KEY,
    parseLLMConfig,
    serializeLLMConfig,
    type LLMConfig,
} from "./llmConfig";

export interface UseLLMConfigResult {
    config: LLMConfig;
    provider: LLMProviderDescriptor;
    apiKey: string | null;
    /** Whether an LLM call can actually be made — what the LLM buttons gate on. */
    isReady: boolean;
    saveConfig: (config: LLMConfig) => Promise<unknown>;
    /**
     * Writes a key into a named provider's slot. The provider is explicit rather than
     * implied by the current config, so Settings can switch provider and save that
     * provider's key in a single submit.
     */
    saveApiKeyFor: (providerId: string, value: string) => Promise<void>;
}

export const useLLMConfig = (): UseLLMConfigResult => {
    const { value: rawConfig, savePreference } = usePreference(LLM_CONFIG_PREFERENCE_KEY);

    const config = useMemo(() => parseLLMConfig(rawConfig), [rawConfig]);
    const provider = useMemo(() => getProviderOrDefault(config.providerId), [config.providerId]);

    const apiKey = useLLMApiKey(provider.id);
    const queryClient = useQueryClient();

    const saveConfig = useCallback(
        (next: LLMConfig) => savePreference(serializeLLMConfig(next)),
        [savePreference]
    );

    const saveApiKeyFor = useCallback(
        async (providerId: string, value: string) => {
            await secureStorage.setLLMApiKey(providerId, value);
            await queryClient.invalidateQueries({
                queryKey: queryKeys.secureStorage(llmApiKeyStorageKey(providerId)),
            });
        },
        [queryClient]
    );

    return useMemo(
        () => ({
            config,
            provider,
            apiKey,
            isReady: !provider.requiresApiKey || !!apiKey,
            saveConfig,
            saveApiKeyFor,
        }),
        [config, provider, apiKey, saveConfig, saveApiKeyFor]
    );
};
