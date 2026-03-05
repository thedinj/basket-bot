import {
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonModal,
} from "@ionic/react";
import React, { useCallback } from "react";

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
    const handleCancel = useCallback(() => {
        (onCancel ?? onDidDismiss)();
    }, [onCancel, onDidDismiss]);

    const handleConfirm = useCallback(async () => {
        onDidDismiss();
        await onConfirm();
    }, [onDidDismiss, onConfirm]);

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onDidDismiss} className="confirm-modal">
            <IonCard>
                <IonCardHeader>
                    <IonCardTitle>{title}</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                    <div className="confirm-modal__message">{message}</div>
                    <IonButtons className="ion-justify-content-end">
                        {showCancel && <IonButton onClick={handleCancel}>{cancelText}</IonButton>}
                        <IonButton color={confirmColor} onClick={handleConfirm}>
                            {confirmText}
                        </IonButton>
                    </IonButtons>
                </IonCardContent>
            </IonCard>
        </IonModal>
    );
};

export default ConfirmModal;
