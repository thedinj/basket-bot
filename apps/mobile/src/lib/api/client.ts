const API_BASE_URL =
    (typeof import.meta !== "undefined" &&
        (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL) ||
    "http://localhost:3000";

export class ApiClient {
    private accessToken: string | null = null;

    setAccessToken(token: string | null) {
        this.accessToken = token;
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

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

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
