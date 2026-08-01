import pluralize from "pluralize";
import { ApiError } from "../lib/api/client";

/**
 * Format an error for user-friendly display
 * Distinguishes between network errors, server errors, and validation errors
 */
export const formatErrorMessage = (error: unknown, operation?: string): string => {
    if (error instanceof ApiError) {
        // Network errors
        if (error.isNetworkError) {
            if (error.code === "TIMEOUT") {
                return "Request timed out. Please check your connection and try again.";
            }
            return "Network error. Please check your connection.";
        }

        // Session/auth errors
        if (error.code === "SESSION_EXPIRED" || error.status === 401) {
            return "Session expired. Please log in again.";
        }

        // Rate limiting
        if (error.status === 429) {
            return "Too many requests. Please wait a moment and try again.";
        }

        // Server errors
        if (error.status && error.status >= 500) {
            return `Server error. Please try again later. (${error.code || error.status})`;
        }

        // Not found errors
        if (error.status === 404) {
            return "Resource not found or no longer available.";
        }

        // Validation or business logic errors (use server message)
        return operation ? `Failed to ${operation}: ${error.message}` : error.message;
    }

    // Generic error fallback
    if (error instanceof Error) {
        return operation ? `Failed to ${operation}: ${error.message}` : error.message;
    }

    // Unknown error type
    return operation ? `Failed to ${operation}` : "An unexpected error occurred";
};

/**
 * Marker used by mutation hooks that already gave the user specific feedback
 * for an error (e.g. an inline form field message, or a silent cache refresh
 * after a 404) so the global MutationCache error handler doesn't also show a
 * generic toast for the same failure.
 */
const HANDLED_FLAG = Symbol("errorHandled");

export const markErrorHandled = (error: unknown): void => {
    if (error && typeof error === "object") {
        (error as Record<PropertyKey, unknown>)[HANDLED_FLAG] = true;
    }
};

export const isErrorHandled = (error: unknown): boolean => {
    return !!(
        error &&
        typeof error === "object" &&
        (error as Record<PropertyKey, unknown>)[HANDLED_FLAG]
    );
};

/**
 * Check if an error should be queued for retry
 */
export const shouldQueueError = (error: unknown): boolean => {
    return error instanceof ApiError && error.isNetworkError;
};

/**
 * Get a user-friendly message for mutation queue status
 */
export const getQueueStatusMessage = (
    queueSize: number,
    isProcessing: boolean,
    isOnline: boolean
): string | null => {
    if (queueSize === 0) return null;

    if (isProcessing) {
        return `Syncing ${queueSize} ${pluralize("change", queueSize)}...`;
    }

    if (!isOnline) {
        return `${queueSize} ${pluralize("change", queueSize)} will sync when online`;
    }

    return `${queueSize} pending ${pluralize("change", queueSize)}`;
};
