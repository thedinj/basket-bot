import { Capacitor } from "@capacitor/core";
import { KEYS, secureStorage } from "../../utils/secureStorage";
import { serverReachability } from "../serverReachability";

const DEFAULT_API_BASE_URL = (() => {
    // If VITE_API_URL is explicitly set, use that (highest priority)
    if (
        typeof import.meta !== "undefined" &&
        (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL
    ) {
        return (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL;
    }

    // Check if we're in Vite dev mode
    const isDev =
        typeof import.meta !== "undefined" &&
        (import.meta as ImportMeta & { env: Record<string, string> }).env.DEV;

    if (isDev) {
        // In dev mode on native platform, use Android emulator host address
        if (Capacitor.isNativePlatform()) {
            return "http://10.0.2.2:3000";
        }
        // Otherwise (web browser), use localhost
        return "http://localhost:3000";
    }

    // Production default
    return "https://basketbot.ddns.net";
})();

/**
 * Shape of the `details` field on a 429 RATE_LIMIT_EXCEEDED error response.
 */
export interface RateLimitErrorDetails {
    retryAfter: number;
}

/**
 * Custom error class that includes response metadata like token status
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public code?: string,
        public tokenStatus?: string | null,
        public status?: number,
        public isNetworkError: boolean = false,
        public requestId?: string | null,
        public endpoint?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/**
 * Timeout duration for API requests (15 seconds)
 */
const REQUEST_TIMEOUT_MS = 15000;

/**
 * A fetch rejection means "the request never got an answer", but engines disagree on how they
 * say so: Chrome/Android WebView throw `TypeError: Failed to fetch`, WebKit `TypeError: Load
 * failed`, and some Capacitor bridges a plain `Error: Network request failed`. Matching only
 * on "fetch" (as this once did) let the others through untagged, so they skipped the offline
 * queue and were reported to the user as though the server had rejected the request.
 */
const NETWORK_ERROR_PATTERNS = /failed to fetch|load failed|network request failed|networkerror/i;

export const isNetworkErrorLike = (error: unknown): boolean =>
    error instanceof Error &&
    (error instanceof TypeError || NETWORK_ERROR_PATTERNS.test(error.message));

/**
 * Statuses a reverse proxy returns when it is up but the app server behind it is not. The body
 * is the proxy's own HTML, so there is no `code` to parse out of it — these are reachability
 * failures, not application errors, and are tagged as such.
 */
const UNREACHABLE_STATUSES = new Set([502, 503, 504]);

export class ApiClient {
    private baseUrl: string = DEFAULT_API_BASE_URL;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private isRefreshing = false;
    private refreshPromise: Promise<string> | null = null;
    private authReadyPromise: Promise<void>;
    private authReadyResolver!: () => void;

    constructor() {
        // Create a promise that resolves when auth is initialized
        this.authReadyPromise = new Promise<void>((resolve) => {
            this.authReadyResolver = resolve;
        });
        serverReachability.setBaseUrl(this.baseUrl);
    }

    setBaseUrl(url: string) {
        this.baseUrl = url;
        // Keep health probes pointed at the same host the app's requests use.
        serverReachability.setBaseUrl(url);
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    setRefreshToken(token: string | null) {
        this.refreshToken = token;
    }

    /**
     * Mark authentication as ready (either tokens loaded and validated, or no tokens found)
     * This allows all pending requests to proceed
     */
    markAuthReady() {
        this.authReadyResolver();
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
                // The refresh call gets the same timeout as any other request. Without one it
                // could hang indefinitely against an unresponsive host, holding every queued
                // request behind it.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                let response: Response;
                try {
                    response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ refreshToken: this.refreshToken }),
                        signal: controller.signal,
                    });
                } catch (error: unknown) {
                    // An unreachable server is NOT an invalid session. Reporting it as one is
                    // what used to wipe the stored tokens and force a re-login after a brief
                    // outage, so this deliberately leaves `tokenStatus` null and keeps the
                    // refresh token intact.
                    if (
                        (error instanceof Error && error.name === "AbortError") ||
                        isNetworkErrorLike(error)
                    ) {
                        serverReachability.reportUnreachable();
                        throw new ApiError(
                            "Cannot reach the server.",
                            "REFRESH_UNREACHABLE",
                            null,
                            undefined,
                            true,
                            null,
                            "/api/auth/refresh"
                        );
                    }
                    throw error;
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!response.ok) {
                    // Proxy up, app server down: the refresh token was never actually judged,
                    // so it must be kept.
                    if (UNREACHABLE_STATUSES.has(response.status)) {
                        serverReachability.reportUnreachable();
                        throw new ApiError(
                            "Cannot reach the server.",
                            "SERVER_UNAVAILABLE",
                            null,
                            response.status,
                            true,
                            null,
                            "/api/auth/refresh"
                        );
                    }

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

                // Persist the new access token to secure storage
                await secureStorage.set(KEYS.ACCESS_TOKEN, data.accessToken);

                return data.accessToken;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        // Auth endpoints don't need to wait for auth readiness (would cause deadlock)
        const isAuthEndpoint = endpoint.startsWith("/api/auth/");

        if (!isAuthEndpoint) {
            // Wait for auth initialization to complete before making any requests
            await this.authReadyPromise;
        }

        // Always use a plain object for headers so we can assign to it
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers ? Object.fromEntries(Object.entries(options.headers)) : {}),
        };

        if (this.accessToken) {
            headers["Authorization"] = `Bearer ${this.accessToken}`;
        } else if (!isAuthEndpoint) {
            console.warn("[ApiClient] No access token for:", endpoint);
        }

        // Set up timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            return await this.handleResponse<T>(response, endpoint, options, headers);
        } catch (error: unknown) {
            clearTimeout(timeoutId);

            // Handle network errors (timeout, no connection, etc.)
            if (error instanceof Error && error.name === "AbortError") {
                serverReachability.reportUnreachable();
                throw new ApiError(
                    "Request timed out. Please check your connection.",
                    "TIMEOUT",
                    null,
                    408,
                    true,
                    null,
                    endpoint
                );
            }
            if (isNetworkErrorLike(error)) {
                serverReachability.reportUnreachable();
                throw new ApiError(
                    "Network error. Please check your connection.",
                    "NETWORK_ERROR",
                    null,
                    undefined,
                    true,
                    null,
                    endpoint
                );
            }
            throw error;
        }
    }

    private async handleResponse<T>(
        response: Response,
        endpoint: string,
        options: RequestInit,
        headers: Record<string, string>
    ): Promise<T> {
        let responseToUse = response;

        // If 401 with invalid token header, access token is definitely invalid - clear it immediately
        const requestHeaders = options.headers as Record<string, string> | undefined;
        const tokenStatus = responseToUse.headers.get("X-Token-Status");

        if (
            responseToUse.status === 401 &&
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

                    // Set up new timeout for retry
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                    try {
                        responseToUse = await fetch(`${this.baseUrl}${endpoint}`, {
                            ...options,
                            headers,
                            signal: controller.signal,
                        });
                        clearTimeout(timeoutId);
                    } catch (retryError: unknown) {
                        clearTimeout(timeoutId);
                        if (retryError instanceof Error && retryError.name === "AbortError") {
                            throw new ApiError(
                                "Request timed out after token refresh",
                                "TIMEOUT",
                                null,
                                408,
                                true
                            );
                        }
                        throw retryError;
                    }
                } catch (refreshError) {
                    // Refresh token was already cleared in refreshAccessToken if needed.
                    // Only a refusal by the server means the session is over. A refresh that
                    // never reached the server says nothing about the token's validity, and
                    // calling it "expired" here is what used to log the user out during an
                    // outage — `AuthProvider` deletes stored tokens on `tokenStatus: "invalid"`.
                    if (refreshError instanceof ApiError) {
                        throw refreshError;
                    }
                    if (isNetworkErrorLike(refreshError)) {
                        serverReachability.reportUnreachable();
                        throw new ApiError(
                            "Cannot reach the server.",
                            "REFRESH_UNREACHABLE",
                            null,
                            undefined,
                            true,
                            null,
                            endpoint
                        );
                    }
                    throw new ApiError(
                        "Session expired, please log in again",
                        "SESSION_EXPIRED",
                        "invalid",
                        401
                    );
                }
            } else {
                // No refresh token available
                throw new ApiError(
                    "Session expired, please log in again",
                    "SESSION_EXPIRED",
                    "invalid",
                    401
                );
            }
        }

        // A proxy answering for a dead app server is an outage, not a request the server
        // considered and rejected. Its body is the proxy's HTML, so there is no useful code to
        // parse out of it; tag it as a network error so it queues and surfaces like one.
        if (UNREACHABLE_STATUSES.has(responseToUse.status)) {
            serverReachability.reportUnreachable();
            throw new ApiError(
                "Cannot reach the server.",
                "SERVER_UNAVAILABLE",
                null,
                responseToUse.status,
                true,
                responseToUse.headers.get("X-Request-Id"),
                endpoint
            );
        }

        // Any other answer — including a 404 or a 400 — proves the server is alive.
        serverReachability.reportReachable();

        if (!responseToUse.ok) {
            const error = await responseToUse.json().catch(() => ({
                code: "UNKNOWN_ERROR",
                message: "An unknown error occurred",
            }));
            const requestId = responseToUse.headers.get("X-Request-Id") ?? error.requestId ?? null;
            throw new ApiError(
                error.message || "Request failed",
                error.code || "UNKNOWN_ERROR",
                tokenStatus,
                responseToUse.status,
                false,
                requestId,
                endpoint,
                error.details
            );
        }

        return responseToUse.json();
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
