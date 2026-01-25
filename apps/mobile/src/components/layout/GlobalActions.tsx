import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { cloudUploadOutline, refreshOutline } from "ionicons/icons";
import { useMutationQueue } from "../../hooks/useMutationQueue";
import { useRefresh, useSync } from "../../hooks/useRefreshAndSync";

interface GlobalActionsProps {
    /** Optional specific query keys to refresh. If omitted, refreshes all queries */
    refreshQueryKeys?: string[][];
}

/**
 * Global action buttons for refresh and sync
 * To be used in AppHeader children slot
 */
export const GlobalActions: React.FC<GlobalActionsProps> = ({ refreshQueryKeys }) => {
    const { refresh, isRefreshing } = useRefresh();
    const { sync, isSyncing } = useSync();
    const { hasQueuedMutations } = useMutationQueue();

    const handleRefresh = async () => {
        await refresh(refreshQueryKeys);
    };

    const handleSync = async () => {
        await sync();
    };

    return (
        <>
            <IonButton
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh data"
                aria-label="Refresh data"
            >
                {isRefreshing ? (
                    <IonSpinner name="circular" />
                ) : (
                    <IonIcon slot="icon-only" icon={refreshOutline} />
                )}
            </IonButton>
            {hasQueuedMutations && (
                <IonButton
                    onClick={handleSync}
                    disabled={isSyncing}
                    title="Sync pending changes"
                    aria-label="Sync pending changes"
                    color="warning"
                >
                    {isSyncing ? (
                        <IonSpinner name="circular" />
                    ) : (
                        <IonIcon slot="icon-only" icon={cloudUploadOutline} />
                    )}
                </IonButton>
            )}
        </>
    );
};

export default GlobalActions;
