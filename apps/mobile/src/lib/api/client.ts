const API_BASE_URL =
    (typeof import.meta !== "undefined" &&
        (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL) ||
    "http://localhost:3000";

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
                    throw new Error("Refresh token expired or invalid");
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
        }

        let response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        // If 401 and we have a refresh token, try to refresh and retry once
        const requestHeaders = options.headers as Record<string, string> | undefined;
        if (
            response.status === 401 &&
            this.refreshToken &&
            !requestHeaders?.["X-Retry-After-Refresh"]
        ) {
            try {
                await this.refreshAccessToken();

                // Retry the original request with new token
                headers["Authorization"] = `Bearer ${this.accessToken}`;
                headers["X-Retry-After-Refresh"] = "true";

                response = await fetch(`${API_BASE_URL}${endpoint}`, {
                    ...options,
                    headers,
                });
            } catch (refreshError) {
                // Refresh failed, clear tokens and throw
                this.accessToken = null;
                this.refreshToken = null;
                throw new Error("Session expired, please log in again");
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

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }
}

export const apiClient = new ApiClient();
