import { IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { cloudUploadOutline, refreshOutline, sunny, sunnyOutline } from "ionicons/icons";
import { useRefreshContext } from "../../hooks/refresh/useRefreshContext";
import { useKeepAwake } from "../../hooks/useKeepAwake";
import { useMutationQueue } from "../../hooks/useMutationQueue";
import { useSync } from "../../hooks/useRefreshAndSync";
import type { GlobalActionConfig } from "./AppHeaderContext";

interface GlobalActionsProps {
    /** Whether to show the keep-awake button (per-page opt-in) */
    showKeepAwake?: boolean;
    /** Custom page-specific actions */
    actions?: GlobalActionConfig[];
}

/**
 * Global action buttons for refresh and sync
 * To be used in AppHeader children slot
 * Uses configured query keys from RefreshContext
 */
export const GlobalActions: React.FC<GlobalActionsProps> = ({ showKeepAwake = false, actions }) => {
    const { refresh, isRefreshing, configuredQueryKeys } = useRefreshContext();
    const { sync, isSyncing } = useSync();
    const { hasQueuedMutations } = useMutationQueue();
    const {
        isEnabled: keepAwakeEnabled,
        toggle: toggleKeepAwake,
        showKeepAwake: showKeepAwakeButton,
    } = useKeepAwake();

    const handleRefresh = async () => {
        await refresh();
    };

    const handleSync = async () => {
        await sync();
    };

    return (
        <>
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
            {actions?.map((action) => (
                <IonButton
                    key={action.id}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    title={action.title}
                    aria-label={action.ariaLabel}
                    color={action.color}
                >
                    <IonIcon slot="icon-only" icon={action.icon} />
                </IonButton>
            ))}
            {showKeepAwake && showKeepAwakeButton && (
                <IonButton
                    onClick={toggleKeepAwake}
                    title={keepAwakeEnabled ? "Allow screen sleep" : "Keep screen on"}
                    aria-label={keepAwakeEnabled ? "Allow screen sleep" : "Keep screen on"}
                    color={keepAwakeEnabled ? "warning" : undefined}
                >
                    <IonIcon slot="icon-only" icon={keepAwakeEnabled ? sunny : sunnyOutline} />
                </IonButton>
            )}
            {configuredQueryKeys && (
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
            )}
        </>
    );
};

export default GlobalActions;
