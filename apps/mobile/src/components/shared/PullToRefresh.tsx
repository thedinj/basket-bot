import { IonRefresher, IonRefresherContent, RefresherEventDetail } from "@ionic/react";
import { useRefreshContext } from "../../hooks/refresh/useRefreshContext";

/**
 * Pull-to-refresh component that uses local refresh context
 * Place as direct child of IonContent with slot="fixed"
 * Only renders when wrapped in a RefreshConfig with query keys configured
 */
const PullToRefresh: React.FC = () => {
    const refreshContext = useRefreshContext();

    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        try {
            await refreshContext?.refresh();
        } finally {
            // Always complete the gesture, even if refresh fails
            event.detail.complete();
        }
    };

    // Only render if refresh context is available with query keys configured
    if (!refreshContext?.configuredQueryKeys) {
        return null;
    }

    return (
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent />
        </IonRefresher>
    );
};

export default PullToRefresh;
