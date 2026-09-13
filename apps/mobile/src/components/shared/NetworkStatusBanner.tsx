import { IonText } from "@ionic/react";
import { useEffect, useState } from "react";
import { useMutationQueue } from "../../hooks/useMutationQueue";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useServerReachability } from "../../hooks/useServerReachability";
import "./NetworkStatusBanner.scss";
import QueueReviewModal from "./QueueReviewModal";

/**
 * Banner that displays network status and queued mutation count
 * Shows when the device is offline, when the backend is unreachable, or when there are
 * pending mutations. Click to open queue review modal when there are pending changes.
 */
export const NetworkStatusBanner: React.FC = () => {
    const { isOffline } = useNetworkStatus();
    const { isUnreachable, probeNow } = useServerReachability();
    const { queueSize, isProcessing } = useMutationQueue();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Don't show banner if everything is healthy and nothing is queued
    const isHidden = !isOffline && !isUnreachable && queueSize === 0;

    // The banner is pinned (see the .scss); this is what reserves its space by pushing the
    // tab shell down. Same body-class approach Main.tsx uses for `has-tabs`.
    useEffect(() => {
        document.body.classList.toggle("has-status-banner", !isHidden);

        return () => {
            document.body.classList.remove("has-status-banner");
        };
    }, [isHidden]);

    const handleClick = () => {
        if (queueSize > 0) {
            setIsModalOpen(true);
        } else if (isUnreachable) {
            probeNow();
        }
    };

    if (isHidden) {
        return null;
    }

    // One short phrase, no counts and no countdown: this is a status strip on a phone, and
    // the detail belongs in the queue review modal a tap away.
    let message: string;
    let colorClass: string;

    if (isOffline) {
        message = "Network down. Not my doing.";
        colorClass = "warning";
    } else if (isUnreachable) {
        message = "Network down. Retrying.";
        colorClass = "warning";
    } else if (isProcessing) {
        message = "Syncing. Patience.";
        colorClass = "primary";
    } else if (queueSize > 0) {
        // Queued work only exists because a request didn't reach the server, so this stays in
        // the same warning register rather than reading as neutral bookkeeping.
        message = "Network down. Changes not sent.";
        colorClass = "warning";
    } else {
        return null;
    }

    // Tapping reviews the queue when there is one, otherwise re-probes an unreachable server.
    const isClickable = queueSize > 0 || isUnreachable;

    return (
        <>
            <div
                className={`network-status-banner network-status-banner--${colorClass} ${
                    isClickable ? "network-status-banner--clickable" : ""
                }`}
                onClick={handleClick}
            >
                <IonText color={colorClass}>
                    <small>{message}</small>
                </IonText>
            </div>
            <QueueReviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};

export default NetworkStatusBanner;
