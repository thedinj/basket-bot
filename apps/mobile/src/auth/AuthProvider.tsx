import type { LoginRequest, LoginResponse, LoginUser } from "@basket-bot/core";
import React, { useEffect, useState, type PropsWithChildren } from "react";
import { apiClient } from "../lib/api/client";
import { KEYS, secureStorage } from "../utils/secureStorage";
import { AuthContext, type AuthContextValue } from "./AuthContext";

interface MeResponse {
    user: LoginUser;
}

interface CreateUserRequest {
    email: string;
    name: string;
    password: string;
}

/**
 * Provider for authentication context
 * Manages user state, tokens, and authentication flow
 */
export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<LoginUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Load tokens from secure storage and restore session on mount
     */
    useEffect(() => {
        const loadTokens = async () => {
            try {
                const [accessToken, refreshToken] = await Promise.all([
                    secureStorage.get(KEYS.ACCESS_TOKEN),
                    secureStorage.get(KEYS.REFRESH_TOKEN),
                ]);

                if (accessToken && refreshToken) {
                    apiClient.setAccessToken(accessToken);
                    apiClient.setRefreshToken(refreshToken);

                    // Verify token by fetching current user
                    try {
                        const response = await apiClient.get<MeResponse>("/api/auth/me");
                        setUser(response.user);
                    } catch (error) {
                        // Token is invalid, clear it
                        console.error("Failed to verify stored tokens:", error);
                        await Promise.all([
                            secureStorage.remove(KEYS.ACCESS_TOKEN),
                            secureStorage.remove(KEYS.REFRESH_TOKEN),
                        ]);
                        apiClient.setAccessToken(null);
                        apiClient.setRefreshToken(null);
                    }
                }
            } catch (error) {
                console.error("Failed to load tokens:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTokens();
    }, []);

    /**
     * Clear tokens from storage and API client
     */
    const clearTokens = async () => {
        await Promise.all([
            secureStorage.remove(KEYS.ACCESS_TOKEN),
            secureStorage.remove(KEYS.REFRESH_TOKEN),
        ]);

        apiClient.setAccessToken(null);
        apiClient.setRefreshToken(null);
    };

    /**
     * Login with email and password
     */
    const login = async (email: string, password: string) => {
        try {
            const credentials: LoginRequest = { email, password };

            const response = await apiClient.post<LoginResponse>("/api/auth/login", credentials);

            // Store tokens in secure storage
            await Promise.all([
                secureStorage.set(KEYS.ACCESS_TOKEN, response.accessToken),
                secureStorage.set(KEYS.REFRESH_TOKEN, response.refreshToken),
            ]);

            // Set tokens in API client
            apiClient.setAccessToken(response.accessToken);
            apiClient.setRefreshToken(response.refreshToken);

            // Update user state
            setUser(response.user);
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    /**
     * Register a new user and auto-login
     */
    const register = async (email: string, name: string, password: string) => {
        try {
            const userData: CreateUserRequest = { email, name, password };

            // Create user account
            await apiClient.post("/api/auth/register", userData);

            // Auto-login with same credentials
            await login(email, password);
        } catch (error) {
            console.error("Registration failed:", error);
            throw error;
        }
    };

    /**
     * Logout and clear all authentication data
     */
    const logout = async () => {
        try {
            // Get refresh token to revoke it
            const refreshToken = await secureStorage.get(KEYS.REFRESH_TOKEN);

            if (refreshToken) {
                // Call backend to revoke refresh token
                await apiClient.post("/api/auth/logout", { refreshToken });
            }

            await clearTokens();
            setUser(null);
        } catch (error) {
            console.error("Logout failed:", error);
            // Clear tokens even if backend call fails
            await clearTokens();
            setUser(null);
        }
    };

    const value: AuthContextValue = {
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
    };

    // Show loading state while checking for stored tokens
    if (isLoading) {
        return null; // Or return a loading component if preferred
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
