import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline, trashOutline } from "ionicons/icons";
import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import type { QueuedMutation } from "../../lib/mutationQueue";
import { mutationQueue } from "../../lib/mutationQueue";
import "./QueueReviewModal.scss";

interface QueueReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Modal to review and manage queued mutations
 * Allows users to see what's pending and clear individual items or the entire queue
 */
const QueueReviewModal: React.FC<QueueReviewModalProps> = ({ isOpen, onClose }) => {
    const [queue, setQueue] = useState<readonly QueuedMutation[]>([]);
    const { showSuccess, showError } = useToast();

    // Load queue when modal opens
    const handleWillPresent = () => {
        setQueue(mutationQueue.getQueue());
    };

    // Clear all mutations
    const handleClearAll = async () => {
        try {
            await mutationQueue.clearQueue();
            showSuccess("Cleared all pending changes");
            setQueue([]);
            onClose();
        } catch (error: unknown) {
            console.error("[QueueReviewModal] Failed to clear queue:", error);
            showError("Failed to clear queue");
        }
    };

    // Remove a specific mutation
    const handleRemove = async (mutationId: string) => {
        try {
            await mutationQueue.removeMutation(mutationId);
            showSuccess("Removed pending change");
            setQueue(mutationQueue.getQueue());
        } catch (error: unknown) {
            console.error("[QueueReviewModal] Failed to remove mutation:", error);
            showError("Failed to remove change");
        }
    };

    // Format timestamp
    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // Format operation name
    const formatOperation = (mutation: QueuedMutation): string => {
        const method = mutation.method.toUpperCase();
        const operation = mutation.operation || "Unknown";
        return `${method}: ${operation}`;
    };

    return (
        <IonModal isOpen={isOpen} onWillPresent={handleWillPresent} onDidDismiss={onClose}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Pending Changes</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                {queue.length === 0 ? (
                    <div className="queue-empty">
                        <IonText color="medium">
                            <p>No pending changes</p>
                        </IonText>
                    </div>
                ) : (
                    <>
                        <div className="queue-header">
                            <IonText color="medium">
                                <p>
                                    {queue.length} pending{" "}
                                    {queue.length === 1 ? "change" : "changes"}
                                </p>
                            </IonText>
                            <IonButton
                                size="small"
                                color="danger"
                                fill="outline"
                                onClick={handleClearAll}
                            >
                                Clear All
                            </IonButton>
                        </div>
                        <IonList>
                            {queue.map((mutation) => (
                                <IonItem key={mutation.id} className="queue-item">
                                    <div className="queue-item-content">
                                        <IonLabel>
                                            <h3>{formatOperation(mutation)}</h3>
                                            <p className="queue-item-detail">
                                                {formatTimestamp(mutation.timestamp)}
                                            </p>
                                            {mutation.retryCount > 0 && (
                                                <p className="queue-item-retry">
                                                    Retry count: {mutation.retryCount}
                                                </p>
                                            )}
                                            {mutation.lastError && (
                                                <p className="queue-item-error">
                                                    Last error: {mutation.lastError}
                                                </p>
                                            )}
                                        </IonLabel>
                                        <IonButton
                                            slot="end"
                                            fill="clear"
                                            color="danger"
                                            onClick={() => handleRemove(mutation.id)}
                                        >
                                            <IonIcon slot="icon-only" icon={trashOutline} />
                                        </IonButton>
                                    </div>
                                </IonItem>
                            ))}
                        </IonList>
                    </>
                )}
            </IonContent>
        </IonModal>
    );
};

export default QueueReviewModal;
