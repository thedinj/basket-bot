import type { CreateUserRequest, LoginRequest, LoginResponse } from "@basket-bot/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";
import { KEYS, secureStorage } from "../utils/secureStorage";

interface LogoutRequest {
    refreshToken: string;
}

/**
 * Hook to fetch current authenticated user
 * Only enabled when explicitly requested
 */
export const useAuthUser = (enabled: boolean) => {
    return useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const response = await apiClient.get<LoginResponse>("/api/auth/me");
            return response;
        },
        enabled,
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        retry: false, // Don't retry if token is invalid
    });
};

/**
 * Hook for login mutation
 * Stores tokens and returns user data
 */
export const useLoginMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (credentials: LoginRequest) => {
            const response = await apiClient.post<LoginResponse>("/api/auth/login", credentials);
            return response;
        },
        onSuccess: async (response) => {
            // Store tokens in secure storage
            await Promise.all([
                secureStorage.set(KEYS.ACCESS_TOKEN, response.accessToken),
                secureStorage.set(KEYS.REFRESH_TOKEN, response.refreshToken),
            ]);

            // Set tokens in API client
            apiClient.setAccessToken(response.accessToken);
            apiClient.setRefreshToken(response.refreshToken);

            // Invalidate any cached user data
            queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        },
    });
};

/**
 * Hook for register mutation
 * Creates account and returns credentials for auto-login
 */
export const useRegisterMutation = () => {
    return useMutation({
        mutationFn: async (userData: CreateUserRequest) => {
            await apiClient.post("/api/auth/register", userData);
            return { email: userData.email, password: userData.password };
        },
    });
};

/**
 * Hook for logout mutation
 * Revokes refresh token and clears local tokens
 */
export const useLogoutMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (request: LogoutRequest) => {
            await apiClient.post("/api/auth/logout", request);
        },
        onSettled: async () => {
            // Invalidate all queries first (triggers refetch/cleanup)
            await queryClient.invalidateQueries();

            // Clear all cached query data
            queryClient.clear();

            // Clear tokens from secure storage
            await Promise.all([
                secureStorage.remove(KEYS.ACCESS_TOKEN),
                secureStorage.remove(KEYS.REFRESH_TOKEN),
            ]);

            // Clear tokens from API client
            apiClient.setAccessToken(null);
            apiClient.setRefreshToken(null);
        },
    });
};
