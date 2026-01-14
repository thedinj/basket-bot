import { useIonToast } from "@ionic/react";
import { useCallback } from "react";

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
 */
export function useToast() {
    const [present] = useIonToast();

    const showToast = useCallback(
        ({
            message,
            type = "info",
            duration = 3000,
            position = "top",
        }: ToastOptions) => {
            present({
                message,
                duration,
                color: colorMap[type],
                position,
            });
        },
        [present]
    );

    // Convenience methods for common toast types
    const showSuccess = useCallback(
        (
            message: string,
            options?: Partial<Omit<ToastOptions, "message" | "type">>
        ) => {
            showToast({ message, type: "success", ...options });
        },
        [showToast]
    );

    const showError = useCallback(
        (
            message: string,
            options?: Partial<Omit<ToastOptions, "message" | "type">>
        ) => {
            showToast({ message, type: "error", ...options });
        },
        [showToast]
    );

    const showInfo = useCallback(
        (
            message: string,
            options?: Partial<Omit<ToastOptions, "message" | "type">>
        ) => {
            showToast({ message, type: "info", ...options });
        },
        [showToast]
    );

    const showWarning = useCallback(
        (
            message: string,
            options?: Partial<Omit<ToastOptions, "message" | "type">>
        ) => {
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
