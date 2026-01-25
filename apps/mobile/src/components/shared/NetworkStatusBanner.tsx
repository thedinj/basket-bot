import { IonText } from "@ionic/react";
import pluralize from "pluralize";
import { useMutationQueue } from "../../hooks/useMutationQueue";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import "./NetworkStatusBanner.scss";

/**
 * Banner that displays network status and queued mutation count
 * Shows when offline or when there are pending mutations
 */
export const NetworkStatusBanner: React.FC = () => {
    const { isOffline } = useNetworkStatus();
    const { queueSize, isProcessing } = useMutationQueue();

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
        <div className={`network-status-banner network-status-banner--${colorClass}`}>
            <IonText color={colorClass}>
                <small>{message}</small>
            </IonText>
        </div>
    );
};

export default NetworkStatusBanner;
