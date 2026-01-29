import { IonRefresher, IonRefresherContent, RefresherEventDetail } from "@ionic/react";
import { useRefreshContext } from "../../hooks/refresh/useRefreshContext";

/**
 * Pull-to-refresh component that uses shared refresh context
 * Place as direct child of IonContent with slot="fixed"
 * Uses configured query keys from RefreshContext
 * Only renders when query keys are configured via RefreshConfig
 */
const PullToRefresh: React.FC = () => {
    const { refresh, configuredQueryKeys } = useRefreshContext();

    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        try {
            await refresh();
        } finally {
            // Always complete the gesture, even if refresh fails
            event.detail.complete();
        }
    };

    // Only render if query keys are configured
    if (!configuredQueryKeys) {
        return null;
    }

    return (
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent />
        </IonRefresher>
    );
};

export default PullToRefresh;
