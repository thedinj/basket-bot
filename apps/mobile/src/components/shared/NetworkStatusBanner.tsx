import { App as CapacitorApp } from "@capacitor/app";
import { IonIcon } from "@ionic/react";
import { chevronForward } from "ionicons/icons";
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
/**
 * How long a problem has to last before the strip appears. It takes its own space (it pushes
 * the whole tab shell down), so a state that resolves itself in a moment — a request that
 * fails as the radio wakes on resume, a mutation that queues and drains at once — would show
 * as a bar appearing and vanishing while the list jumps under the user's thumb. Waiting says
 * nothing false: a real outage still gets the strip a second or two later, and it goes the
 * instant things recover.
 */
const APPEARANCE_DELAY_MS = 3000;

/**
 * The longer wait that applies just after the app comes back.
 *
 * A phone that has been asleep takes a few seconds to get its radio back, and everything the
 * app does on resume — refetching the list, replaying the queue, reconnecting the stream —
 * happens inside that window and genuinely fails. The strip that follows is *true* and
 * useless: it says the network is down at the one moment it is expected to be, and it is gone
 * again before it can be read. Long enough to outlast a normal reassociation; a real outage
 * still gets the strip, a few seconds into the session rather than on the first frame.
 */
const RESUME_GRACE_MS = 8000;

export const NetworkStatusBanner: React.FC = () => {
    const { isOffline } = useNetworkStatus();
    const { isUnreachable, probeNow } = useServerReachability();
    const { queueSize, isProcessing } = useMutationQueue();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hasSettled, setHasSettled] = useState(false);
    /** When the app last came back to the foreground; null if it hasn't this session. */
    const [resumedAt, setResumedAt] = useState<number | null>(null);

    // Don't show banner if everything is healthy and nothing is queued
    const isHealthy = !isOffline && !isUnreachable && queueSize === 0;

    // Coming back starts the wait again, so a strip raised while the screen was off (where the
    // wait ran down unseen) isn't the first thing on screen.
    useEffect(() => {
        const onResume = () => {
            setResumedAt(Date.now());
            setHasSettled(false);
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                onResume();
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
            if (isActive) {
                onResume();
            }
        });

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            void listener.then((handle) => handle.remove());
        };
    }, []);

    // Appearing waits out the delay; recovering hides it at once.
    useEffect(() => {
        if (isHealthy) {
            setHasSettled(false);
            return;
        }

        const sinceResume = resumedAt === null ? Infinity : Date.now() - resumedAt;
        const delay =
            sinceResume < RESUME_GRACE_MS ? RESUME_GRACE_MS - sinceResume : APPEARANCE_DELAY_MS;
        const timer = setTimeout(() => setHasSettled(true), delay);

        return () => clearTimeout(timer);
    }, [isHealthy, resumedAt]);

    const isHidden = isHealthy || !hasSettled;

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
    let colorClass: "warning" | "primary";

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

    const className = `network-status-banner network-status-banner--${colorClass}`;
    const content = (
        <>
            <span className="network-status-banner__message">{message}</span>
            {queueSize > 0 && (
                <IonIcon
                    className="network-status-banner__trail"
                    icon={chevronForward}
                    aria-hidden="true"
                />
            )}
        </>
    );

    return (
        <>
            {isClickable ? (
                <button
                    type="button"
                    className={`${className} network-status-banner--clickable`}
                    onClick={handleClick}
                    aria-live="polite"
                >
                    {content}
                </button>
            ) : (
                <div className={className} role="status" aria-live="polite">
                    {content}
                </div>
            )}
            <QueueReviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};

export default NetworkStatusBanner;
