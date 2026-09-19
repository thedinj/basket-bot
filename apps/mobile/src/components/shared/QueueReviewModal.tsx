import { IonContent, IonModal, useIonAlert } from "@ionic/react";
import { cloudDoneOutline } from "ionicons/icons";
import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import type { QueuedMutation } from "../../lib/mutationQueue";
import { mutationQueue } from "../../lib/mutationQueue";
import { DestructiveAction } from "./DestructiveAction";
import { ModalHeader } from "./ModalHeader";
import { RowRemoveButton } from "./RowRemoveButton";
import TabEmptyState from "./TabEmptyState";
import "./QueueReviewModal.scss";

interface QueueReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

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

/**
 * Modal to review and manage queued mutations
 * Allows users to see what's pending and clear individual items or the entire queue
 */
const QueueReviewModal: React.FC<QueueReviewModalProps> = ({ isOpen, onClose }) => {
    const [queue, setQueue] = useState<readonly QueuedMutation[]>([]);
    const { showSuccess, showError } = useToast();
    const [presentAlert] = useIonAlert();

    // Load queue when modal opens
    const handleWillPresent = () => {
        setQueue(mutationQueue.getQueue());
    };

    // Clear all mutations
    const clearAll = async () => {
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

    // Discarding the whole queue can't be undone, so it confirms first.
    const handleClearAll = () => {
        presentAlert({
            header: "Discard All Changes",
            message: `Discard ${queue.length} pending ${
                queue.length === 1 ? "change" : "changes"
            }? They will never reach the server.`,
            buttons: [
                "Cancel",
                {
                    text: "Discard",
                    role: "destructive",
                    handler: () => {
                        void clearAll();
                    },
                },
            ],
        });
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

    return (
        <IonModal isOpen={isOpen} onWillPresent={handleWillPresent} onDidDismiss={onClose}>
            <ModalHeader title="Pending Changes" onClose={onClose} />
            <IonContent className={queue.length === 0 ? undefined : "ion-padding"}>
                {queue.length === 0 ? (
                    <TabEmptyState
                        variant="full"
                        icon={cloudDoneOutline}
                        title="Nothing pending"
                        body="Every change made it through. Nothing is waiting on the network."
                    />
                ) : (
                    <div className="queue-review">
                        <section className="queue-review__section">
                            <h2 className="ruled-label">
                                Pending <span className="ruled-label__count">{queue.length}</span>
                            </h2>
                            <ul className="queue-review__list">
                                {queue.map((mutation) => (
                                    <li key={mutation.id} className="queue-row">
                                        <div className="queue-row__text">
                                            <span className="queue-row__operation">
                                                {formatOperation(mutation)}
                                            </span>
                                            <span className="queue-row__meta">
                                                {formatTimestamp(mutation.timestamp)}
                                                {mutation.retryCount > 0 && (
                                                    <>
                                                        {" · "}
                                                        <span className="queue-row__retry">
                                                            Retry count: {mutation.retryCount}
                                                        </span>
                                                    </>
                                                )}
                                            </span>
                                            {mutation.lastError && (
                                                <p className="queue-row__error">
                                                    Last error: {mutation.lastError}
                                                </p>
                                            )}
                                        </div>
                                        <RowRemoveButton
                                            onClick={() => handleRemove(mutation.id)}
                                            label={`Discard ${formatOperation(mutation)}`}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <DestructiveAction onClick={handleClearAll}>
                            Discard all changes
                        </DestructiveAction>
                    </div>
                )}
            </IonContent>
        </IonModal>
    );
};

export default QueueReviewModal;
