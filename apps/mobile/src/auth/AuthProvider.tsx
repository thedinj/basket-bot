import type { LoginUser } from "@basket-bot/core";
import { Preferences } from "@capacitor/preferences";
import React, { useEffect, useState, type PropsWithChildren } from "react";
import { apiClient, ApiError } from "../lib/api/client";
import { KEYS, secureStorage } from "../utils/secureStorage";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import {
    useAuthUser,
    useLoginMutation,
    useLogoutMutation,
    useRegisterMutation,
} from "./useAuthMutations";

/**
 * Provider for authentication context
 * Manages user state and authentication flow using React Query
 */
export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<LoginUser | null>(null);
    const [hasTokens, setHasTokens] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    const loginMutation = useLoginMutation();
    const registerMutation = useRegisterMutation();
    const logoutMutation = useLogoutMutation();

    // Use React Query to fetch user data when tokens are available
    const {
        data: userData,
        error: userError,
        isSuccess: authQuerySuccess,
    } = useAuthUser(hasTokens);

    /**
     * Load tokens from secure storage on mount
     */
    useEffect(() => {
        const loadTokens = async () => {
            try {
                // Load remote API URL preference first
                const { value: remoteApiUrl } = await Preferences.get({
                    key: "remote_api_url",
                });

                // Apply custom API URL if configured
                if (remoteApiUrl?.trim()) {
                    apiClient.setBaseUrl(remoteApiUrl.trim());
                    console.log("[AuthProvider] Using custom API URL:", remoteApiUrl.trim());
                }

                const [accessToken, refreshToken] = await Promise.all([
                    secureStorage.get(KEYS.ACCESS_TOKEN),
                    secureStorage.get(KEYS.REFRESH_TOKEN),
                ]);

                if (accessToken && refreshToken) {
                    console.log("[AuthProvider] Tokens loaded from storage, setting in apiClient");
                    apiClient.setAccessToken(accessToken);
                    apiClient.setRefreshToken(refreshToken);
                    console.log("[AuthProvider] Tokens set, triggering useAuthUser query");
                    setHasTokens(true); // This will trigger useAuthUser query
                } else {
                    console.log("[AuthProvider] No tokens found in storage");
                    setIsInitializing(false);
                }
            } catch (error) {
                console.error("Failed to load tokens:", error);
                setIsInitializing(false);
            }
        };

        loadTokens();
    }, []);

    /**
     * Update user state when query data changes
     */
    useEffect(() => {
        if (userData) {
            console.log(
                "[AuthProvider] useAuthUser query succeeded, user data received:",
                userData.user.email
            );
            setUser(userData.user);
            setIsInitializing(false);
        }
    }, [userData]);

    /**
     * Handle user fetch errors (invalid token)
     * Only clear tokens if the error has tokenStatus=invalid
     * (which means refresh token is also invalid/expired)
     */
    useEffect(() => {
        if (userError) {
            console.error("Failed to verify stored tokens:", userError);

            // Check if this is an ApiError with invalid token status
            const shouldClearTokens =
                userError instanceof ApiError && userError.tokenStatus === "invalid";

            if (shouldClearTokens) {
                const clearInvalidTokens = async () => {
                    await Promise.all([
                        secureStorage.remove(KEYS.ACCESS_TOKEN),
                        secureStorage.remove(KEYS.REFRESH_TOKEN),
                    ]);
                    apiClient.setAccessToken(null);
                    apiClient.setRefreshToken(null);
                    setHasTokens(false);
                    setIsInitializing(false);
                };
                clearInvalidTokens();
            } else {
                // For other errors, just finish initializing
                setIsInitializing(false);
            }
        }
    }, [userError]);

    /**
     * Login with email and password using React Query mutation
     */
    const login = async (email: string, password: string) => {
        try {
            const response = await loginMutation.mutateAsync({ email, password });
            setUser(response.user);
            setHasTokens(true);
        } catch (error) {
            console.error("[AuthProvider] Login failed:", error);
            throw error;
        }
    };

    /**
     * Register a new user and auto-login using React Query mutations
     */
    const register = async (
        email: string,
        name: string,
        password: string,
        invitationCode?: string
    ) => {
        try {
            // Create user account
            await registerMutation.mutateAsync({ email, name, password, invitationCode });

            // Auto-login with same credentials
            await login(email, password);
        } catch (error) {
            console.error("Registration failed:", error);
            throw error;
        }
    };

    /**
     * Logout and clear all authentication data using React Query mutation
     */
    const logout = async () => {
        try {
            const refreshToken = await secureStorage.get(KEYS.REFRESH_TOKEN);

            if (refreshToken) {
                // This will trigger token cleanup and query invalidation in onSettled
                await logoutMutation.mutateAsync({ refreshToken });
            }
        } catch (error) {
            console.error("Logout failed:", error);
            // Continue with cleanup even if server logout fails
        } finally {
            // Update local state after mutation completes (success or failure)
            setUser(null);
            setHasTokens(false);
        }
    };

    const value: AuthContextValue = {
        user,
        isAuthenticated: !!user,
        isInitializing,
        isAuthReady: !isInitializing && (authQuerySuccess || !hasTokens),
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
