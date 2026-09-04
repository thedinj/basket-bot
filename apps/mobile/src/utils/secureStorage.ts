import { Capacitor } from "@capacitor/core";

/**
 * Secure storage service for sensitive data like API keys.
 *
 * Platform-specific behavior:
 * - Android: Uses Android Keystore via @capacitor-community/secure-storage
 * - Web: Uses localStorage (persists after browser closes)
 *
 * Security notes:
 * - Android Keystore requires device to have secure lock screen
 * - Web localStorage is NOT secure - stored as plain text, accessible by JS
 * - Web storage is acceptable for development/testing, NOT production
 * - All operations are async to maintain consistent API across platforms
 */

const STORAGE_PREFIX = "secure_";

export const KEYS = {
    ACCESS_TOKEN: "auth_access_token",
    REFRESH_TOKEN: "auth_refresh_token",
} as const;

/**
 * Where the key for a given LLM provider lives. Keys are stored per provider so switching
 * provider does not destroy the previous one.
 */
export const llmApiKeyStorageKey = (providerId: string): string => `llm_api_key_${providerId}`;

/**
 * The key slot used before providers were configurable. Still read (never written) so an
 * existing install keeps working without the user re-entering their OpenAI key.
 */
const LEGACY_OPENAI_API_KEY = "openai_api_key";

// Type for the secure storage plugin (loaded dynamically)
type SecureStoragePlugin = {
    get: (options: { key: string }) => Promise<{ value: string }>;
    set: (options: { key: string; value: string }) => Promise<void>;
    remove: (options: { key: string }) => Promise<void>;
    clear: () => Promise<void>;
};

class SecureStorageService {
    private isNative: boolean;
    private plugin: SecureStoragePlugin | null = null;
    private pluginPromise: Promise<void> | null = null;

    constructor() {
        this.isNative = Capacitor.isNativePlatform();

        // Only import plugin on native platforms
        if (this.isNative) {
            this.pluginPromise = import("capacitor-secure-storage-plugin")
                .then((module) => {
                    this.plugin = module.SecureStoragePlugin as unknown as SecureStoragePlugin;
                })
                .catch((error) => {
                    console.error("Failed to load SecureStoragePlugin:", error);
                });
        }
    }

    private async ensurePlugin(): Promise<void> {
        if (this.isNative && this.pluginPromise) {
            await this.pluginPromise;
        }
    }

    /**
     * Get a value from secure storage.
     *
     * @param key The storage key
     * @returns The stored value, or null if not found
     * @throws Error if secure storage is not available on native platform
     */
    async get(key: string): Promise<string | null> {
        if (this.isNative) {
            await this.ensurePlugin();

            if (!this.plugin) {
                throw new Error("SecureStoragePlugin not loaded");
            }

            try {
                const result = await this.plugin.get({
                    key,
                });
                return result.value || null;
            } catch {
                // Key not found or other error
                return null;
            }
        } else {
            // Web platform: use localStorage
            try {
                const value = localStorage.getItem(STORAGE_PREFIX + key);
                return value;
            } catch {
                // localStorage might not be available
                return null;
            }
        }
    }

    /**
     * Save a value to secure storage.
     *
     * @param key The storage key
     * @param value The value to store
     * @throws Error if secure storage is unavailable or device has no lock screen
     */
    async set(key: string, value: string): Promise<void> {
        if (this.isNative) {
            await this.ensurePlugin();

            if (!this.plugin) {
                throw new Error("SecureStoragePlugin not loaded");
            }

            try {
                await this.plugin.set({
                    key,
                    value: value.trim(),
                });
            } catch (error) {
                console.error("Failed to save to secure storage:", error);
                throw new Error(
                    "Failed to save value. Ensure your device has a secure lock screen enabled."
                );
            }
        } else {
            // Web platform: use localStorage
            try {
                localStorage.setItem(STORAGE_PREFIX + key, value.trim());
            } catch (error) {
                console.error("Failed to save to localStorage:", error);
                throw new Error("Failed to save value to browser storage.");
            }
        }
    }

    /**
     * Remove a value from secure storage.
     *
     * @param key The storage key
     * @throws Error if secure storage is not available on native platform
     */
    async remove(key: string): Promise<void> {
        if (this.isNative) {
            await this.ensurePlugin();

            if (!this.plugin) {
                throw new Error("SecureStoragePlugin not loaded");
            }

            try {
                await this.plugin.remove({
                    key,
                });
            } catch (error) {
                console.warn("Failed to remove from secure storage:", error);
                // Swallow error - key might not exist
            }
        } else {
            // Web platform: remove from localStorage
            try {
                localStorage.removeItem(STORAGE_PREFIX + key);
            } catch (error) {
                console.warn("Failed to remove from localStorage:", error);
            }
        }
    }

    /**
     * Clear all secure storage data.
     * Use with caution - removes all stored keys.
     */
    async clear(): Promise<void> {
        if (this.isNative) {
            await this.ensurePlugin();

            if (!this.plugin) {
                throw new Error("SecureStoragePlugin not loaded");
            }

            try {
                await this.plugin.clear();
            } catch (error) {
                console.error("Failed to clear secure storage:", error);
                throw error;
            }
        } else {
            // Web platform: clear all prefixed keys from localStorage
            try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(STORAGE_PREFIX)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach((key) => localStorage.removeItem(key));
            } catch (error) {
                console.error("Failed to clear localStorage:", error);
                throw error;
            }
        }
    }

    /**
     * Get the API key for an LLM provider.
     *
     * Falls back to the pre-provider OpenAI key slot so installs that predate configurable
     * providers keep working. The fallback is read-only — saving always writes the
     * per-provider key.
     *
     * @param providerId The provider whose key to read
     * @returns The API key, or null if none is stored
     */
    async getLLMApiKey(providerId: string): Promise<string | null> {
        const stored = await this.get(llmApiKeyStorageKey(providerId));
        if (stored) return stored;
        return providerId === "openai" ? this.get(LEGACY_OPENAI_API_KEY) : null;
    }

    /**
     * Save the API key for an LLM provider.
     *
     * @param providerId The provider the key belongs to
     * @param value The API key to store
     */
    async setLLMApiKey(providerId: string, value: string): Promise<void> {
        return this.set(llmApiKeyStorageKey(providerId), value);
    }

    /**
     * Remove the API key for an LLM provider.
     *
     * @param providerId The provider whose key to forget
     */
    async removeLLMApiKey(providerId: string): Promise<void> {
        return this.remove(llmApiKeyStorageKey(providerId));
    }
}

// Singleton instance
export const secureStorage = new SecureStorageService();
