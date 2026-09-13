import { IonButton, IonText } from "@ionic/react";
import { useState } from "react";
import { useRetryCountdown, useServerReachability } from "../hooks/useServerReachability";
import { apiClient } from "../lib/api/client";
import RobotLoadingContent from "./shared/RobotLoadingContent";
import "./ServerUnreachable.scss";

interface ServerUnreachableProps {
    /**
     * Omitted when rendered from `AppErrorBoundary`, which sits above `AuthProvider` and so
     * has no logout to offer.
     */
    onSignOut?: () => void;
}

/**
 * Shown when the backend cannot be reached: at launch with stored credentials, and from the
 * app error boundary when a suspense query gives up mid-session.
 *
 * The alternative — falling through to the login page — is a dead end: signing in needs the
 * same server that just failed to answer, so the user is asked for credentials that cannot
 * be checked. This says what is actually wrong, keeps the session, and retries on its own.
 */
const ServerUnreachable: React.FC<ServerUnreachableProps> = ({ onSignOut }) => {
    const { nextProbeAt, probeNow } = useServerReachability();
    const [isProbing, setIsProbing] = useState(false);
    const seconds = useRetryCountdown(nextProbeAt);

    const handleRetry = async () => {
        setIsProbing(true);
        try {
            await probeNow();
        } finally {
            setIsProbing(false);
        }
    };

    const retryLine =
        isProbing || seconds === null
            ? "Attempting contact."
            : `Retrying in ${seconds} ${seconds === 1 ? "second" : "seconds"}. Watching will not help.`;

    return (
        <div className="server-unreachable">
            <RobotLoadingContent message={null} />

            <IonText className="server-unreachable-copy">
                <h2>The server is not answering.</h2>
                <p className="server-unreachable-host">{apiClient.getBaseUrl()}</p>
                <p>Your session is intact. This is the server's failing, not yours.</p>
                <p className="server-unreachable-retry">{retryLine}</p>
            </IonText>

            <div className="server-unreachable-actions">
                <IonButton expand="block" onClick={handleRetry} disabled={isProbing}>
                    {isProbing ? "Checking..." : "Retry now"}
                </IonButton>
                {onSignOut && (
                    <IonButton expand="block" fill="clear" color="medium" onClick={onSignOut}>
                        Sign out
                    </IonButton>
                )}
            </div>
        </div>
    );
};

export default ServerUnreachable;
