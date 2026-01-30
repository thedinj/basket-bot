import { useIonToast } from "@ionic/react";
import { useCallback, useRef } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
    position?: "top" | "middle" | "bottom";
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
 * Ensures only one toast per position is shown at a time.
 */
export function useToast() {
    const [present, dismiss] = useIonToast();
    const activeToasts = useRef<Map<"top" | "middle" | "bottom", number>>(new Map());

    const showToast = useCallback(
        async ({ message, type = "info", duration = 3000, position = "top" }: ToastOptions) => {
            // If a toast at this position was recently shown, dismiss all toasts first
            if (activeToasts.current.has(position)) {
                await dismiss();
                activeToasts.current.delete(position);
            }

            await present({
                message,
                duration,
                color: colorMap[type],
                position,
                onDidDismiss: () => {
                    // Clean up when toast is dismissed
                    activeToasts.current.delete(position);
                },
            });

            // Track the toast position with current timestamp
            activeToasts.current.set(position, Date.now());
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
