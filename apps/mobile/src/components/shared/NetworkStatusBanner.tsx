import { IonText } from "@ionic/react";
import pluralize from "pluralize";
import { useState } from "react";
import { useMutationQueue } from "../../hooks/useMutationQueue";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import "./NetworkStatusBanner.scss";
import QueueReviewModal from "./QueueReviewModal";

/**
 * Banner that displays network status and queued mutation count
 * Shows when offline or when there are pending mutations
 * Click to open queue review modal when there are pending changes
 */
export const NetworkStatusBanner: React.FC = () => {
    const { isOffline } = useNetworkStatus();
    const { queueSize, isProcessing } = useMutationQueue();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClick = () => {
        if (queueSize > 0) {
            setIsModalOpen(true);
        }
    };

    // Don't show banner if online and no queued mutations
    if (!isOffline && queueSize === 0) {
        return null;
    }

    // Determine banner message and color
    let message: string;
    let colorClass: string;

    if (isOffline) {
        if (queueSize > 0) {
            message = `Offline • ${queueSize} ${pluralize("change", queueSize)} will sync when online`;
            colorClass = "warning";
        } else {
            message = "Offline • Changes will sync when online";
            colorClass = "warning";
        }
    } else if (isProcessing) {
        message = `Syncing ${queueSize} ${pluralize("change", queueSize)}...`;
        colorClass = "primary";
    } else if (queueSize > 0) {
        message = `${queueSize} ${pluralize("change", queueSize)} pending • Tap sync to upload`;
        colorClass = "medium";
    } else {
        return null;
    }

    return (
        <>
            <div
                className={`network-status-banner network-status-banner--${colorClass} ${
                    queueSize > 0 ? "network-status-banner--clickable" : ""
                }`}
                onClick={handleClick}
            >
                <IonText color={colorClass}>
                    <small>
                        {message}
                        {queueSize > 0 && " • Tap to review"}
                    </small>
                </IonText>
            </div>
            <QueueReviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};

export default NetworkStatusBanner;
