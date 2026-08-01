import { toastController } from "@ionic/core";

/**
 * Toast presentation usable outside the React tree (e.g. from the TanStack
 * Query MutationCache global error handler, which runs as a plain callback
 * with no access to hooks like useIonToast).
 */

export type ToastType = "success" | "error" | "info" | "warning";

const colorMap: Record<ToastType, string> = {
    success: "success",
    error: "danger",
    info: "primary",
    warning: "warning",
};

export async function showImperativeToast(message: string, type: ToastType = "info") {
    const toast = await toastController.create({
        message,
        duration: 3000,
        color: colorMap[type],
        position: "top",
    });
    await toast.present();
}
