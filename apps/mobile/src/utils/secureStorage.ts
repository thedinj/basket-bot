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
    OPENAI_API_KEY: "openai_api_key",
    ACCESS_TOKEN: "auth_access_token",
    REFRESH_TOKEN: "auth_refresh_token",
} as const;

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
     * Get the OpenAI API key from secure storage.
     * Legacy method - prefer using get(KEYS.OPENAI_API_KEY) for new code.
     *
     * @returns The API key, or null if not found
     */
    async getApiKey(): Promise<string | null> {
        return this.get(KEYS.OPENAI_API_KEY);
    }

    /**
     * Save the OpenAI API key to secure storage.
     * Legacy method - prefer using set(KEYS.OPENAI_API_KEY, value) for new code.
     *
     * @param value The API key to store
     */
    async setApiKey(value: string): Promise<void> {
        return this.set(KEYS.OPENAI_API_KEY, value);
    }

    /**
     * Remove the OpenAI API key from secure storage.
     * Legacy method - prefer using remove(KEYS.OPENAI_API_KEY) for new code.
     */
    async removeApiKey(): Promise<void> {
        return this.remove(KEYS.OPENAI_API_KEY);
    }
}

// Singleton instance
export const secureStorage = new SecureStorageService();
