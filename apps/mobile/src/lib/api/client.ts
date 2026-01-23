const API_BASE_URL =
    (typeof import.meta !== "undefined" &&
        (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL) ||
    "http://localhost:3000";

/**
 * Custom error class that includes response metadata like token status
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public code?: string,
        public tokenStatus?: string | null
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export class ApiClient {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private isRefreshing = false;
    private refreshPromise: Promise<string> | null = null;

    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    setRefreshToken(token: string | null) {
        this.refreshToken = token;
    }

    /**
     * Refresh the access token using the refresh token.
     * Returns the new access token.
     */
    private async refreshAccessToken(): Promise<string> {
        if (!this.refreshToken) {
            throw new Error("No refresh token available");
        }

        // If already refreshing, wait for that to complete
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: this.refreshToken }),
                });

                if (!response.ok) {
                    const tokenStatus = response.headers.get("X-Token-Status");
                    if (tokenStatus === "invalid") {
                        // Refresh token is invalid/expired - clear it
                        this.refreshToken = null;
                    }
                    const errorData = await response.json().catch(() => ({
                        code: "REFRESH_FAILED",
                        message: "Refresh token expired or invalid",
                    }));
                    throw new ApiError(
                        errorData.message || "Refresh token expired or invalid",
                        errorData.code,
                        tokenStatus
                    );
                }

                const data = await response.json();
                this.accessToken = data.accessToken;
                return data.accessToken;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        // Always use a plain object for headers so we can assign to it
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers ? Object.fromEntries(Object.entries(options.headers)) : {}),
        };

        if (this.accessToken) {
            headers["Authorization"] = `Bearer ${this.accessToken}`;
        } else {
            console.warn("[ApiClient] No access token available for request");
        }

        let response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        // If 401 with invalid token header, access token is definitely invalid - clear it immediately
        const requestHeaders = options.headers as Record<string, string> | undefined;
        const tokenStatus = response.headers.get("X-Token-Status");

        if (
            response.status === 401 &&
            tokenStatus === "invalid" &&
            !requestHeaders?.["X-Retry-After-Refresh"]
        ) {
            // Clear the invalid access token immediately
            this.accessToken = null;

            // Try to refresh if we have a refresh token
            if (this.refreshToken) {
                try {
                    const newAccessToken = await this.refreshAccessToken();

                    // Retry the original request with new token
                    headers["Authorization"] = `Bearer ${newAccessToken}`;
                    headers["X-Retry-After-Refresh"] = "true";

                    response = await fetch(`${API_BASE_URL}${endpoint}`, {
                        ...options,
                        headers,
                    });
                } catch (refreshError) {
                    // Refresh token was already cleared in refreshAccessToken if needed
                    // Re-throw with token status if it's an ApiError, otherwise create new one
                    if (refreshError instanceof ApiError) {
                        throw refreshError;
                    }
                    throw new ApiError(
                        "Session expired, please log in again",
                        "SESSION_EXPIRED",
                        "invalid"
                    );
                }
            } else {
                // No refresh token available
                throw new ApiError(
                    "Session expired, please log in again",
                    "SESSION_EXPIRED",
                    "invalid"
                );
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({
                code: "UNKNOWN_ERROR",
                message: "An unknown error occurred",
            }));
            throw new Error(error.message || "Request failed");
        }

        return response.json();
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "GET" });
    }

    async post<T>(endpoint: string, data: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    async put<T>(endpoint: string, data: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: JSON.stringify(data),
        });
    }

    async patch<T>(endpoint: string, data: unknown): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }
}

export const apiClient = new ApiClient();
