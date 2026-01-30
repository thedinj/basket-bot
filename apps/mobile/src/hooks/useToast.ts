import { useIonToast } from "@ionic/react";
import { useCallback, useRef } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
    position?: "top" | "middle" | "bottom";
    /** Optional ID - if provided, will dismiss any existing toast with the same ID before showing new one */
    id?: string;
}

const colorMap: Record<ToastType, string> = {
    success: "success",
    error: "danger",
    info: "primary",
    warning: "warning",
};

/**
 * Custom hook that wraps Ionic's useIonToast with consistent defaults
 * and a simplified API for showing toast notifications.
 * Supports toast IDs for replacing existing toasts with new content.
 */
export function useToast() {
    const [present, dismiss] = useIonToast();
    const activeToasts = useRef<Map<string, number>>(new Map());

    const showToast = useCallback(
        async ({ message, type = "info", duration = 3000, position = "top", id }: ToastOptions) => {
            // If an ID is provided and a toast with that ID was recently shown, dismiss all toasts first
            if (id && activeToasts.current.has(id)) {
                await dismiss();
                activeToasts.current.delete(id);
            }

            await present({
                message,
                duration,
                color: colorMap[type],
                position,
                onDidDismiss: () => {
                    // Clean up when toast is dismissed
                    if (id) {
                        activeToasts.current.delete(id);
                    }
                },
            });

            // Track the toast ID with current timestamp
            if (id) {
                activeToasts.current.set(id, Date.now());
            }
        },
        [present, dismiss]
    );

    // Convenience methods for common toast types
    const showSuccess = useCallback(
        (message: string, options?: Partial<Omit<ToastOptions, "message" | "type">>) => {
            showToast({ message, type: "success", ...options });
        },
        [showToast]
    );

    const showError = useCallback(
        (message: string, options?: Partial<Omit<ToastOptions, "message" | "type">>) => {
            showToast({ message, type: "error", ...options });
        },
        [showToast]
    );

    const showInfo = useCallback(
        (message: string, options?: Partial<Omit<ToastOptions, "message" | "type">>) => {
            showToast({ message, type: "info", ...options });
        },
        [showToast]
    );

    const showWarning = useCallback(
        (message: string, options?: Partial<Omit<ToastOptions, "message" | "type">>) => {
            showToast({ message, type: "warning", ...options });
        },
        [showToast]
    );

    return {
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
    };
}
