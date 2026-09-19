import { IonButton, IonModal } from "@ionic/react";
import React, { useCallback, useId } from "react";

import "./ConfirmModal.css";

interface ConfirmModalProps {
    isOpen: boolean;
    onDidDismiss: () => void;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    confirmColor?: "primary" | "danger";
    showCancel?: boolean;
    cancelText?: string;
    onCancel?: () => void;
}

/**
 * A small centred dialog: a title, a message (which may be rich content), and a footer row of
 * 48px buttons on the dialog's 16px gutter. The confirm button is solid (danger for a destructive
 * confirm); Cancel is outlined in the field frame so it never competes with it.
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onDidDismiss,
    title,
    message,
    onConfirm,
    confirmText = "OK",
    confirmColor = "primary",
    showCancel = true,
    cancelText = "Cancel",
    onCancel,
}) => {
    const titleId = useId();

    const handleCancel = useCallback(() => {
        (onCancel ?? onDidDismiss)();
    }, [onCancel, onDidDismiss]);

    const handleConfirm = useCallback(async () => {
        onDidDismiss();
        await onConfirm();
    }, [onDidDismiss, onConfirm]);

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={onDidDismiss}
            className="confirm-modal"
            aria-labelledby={titleId}
        >
            <div className="confirm-modal__panel">
                <h2 id={titleId} className="confirm-modal__title">
                    {title}
                </h2>
                <div className="confirm-modal__message">{message}</div>
                <div className="confirm-modal__actions">
                    {showCancel && (
                        <IonButton
                            className="confirm-modal__button confirm-modal__button--cancel"
                            fill="outline"
                            onClick={handleCancel}
                        >
                            {cancelText}
                        </IonButton>
                    )}
                    <IonButton
                        className="confirm-modal__button"
                        color={confirmColor}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </IonButton>
                </div>
            </div>
        </IonModal>
    );
};

export default ConfirmModal;
