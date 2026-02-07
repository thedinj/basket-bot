import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import { IonContent, IonFab, IonFabButton, IonIcon, IonPage } from "@ionic/react";
import { add } from "ionicons/icons";
import { useCallback } from "react";
import { useHistory, useParams } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import GlobalActions from "../components/layout/GlobalActions";
import { FabSpacer } from "../components/shared/FabSpacer";
import PullToRefresh from "../components/shared/PullToRefresh";
import AisleSectionList from "../components/store/AisleSectionList";
import { useStoreManagement } from "../components/store/StoreManagementContext";
import { StoreManagementProvider } from "../components/store/StoreManagementProvider";
import { useStore } from "../db/hooks";
import RefreshConfig from "../hooks/refresh/RefreshConfig";
import { useToast } from "../hooks/useToast";

const StoreAislesPageContent: React.FC<{ storeId: string }> = ({ storeId }) => {
    useRenderStormDetector("StoreAislesPageContent", { storeId });
    const history = useHistory();
    const { data: store, isLoading } = useStore(storeId);
    const { openCreateModal, mode } = useStoreManagement();
    const { showError } = useToast();

    const handleFabClick = useCallback(() => {
        if (mode === "aisles") {
            openCreateModal("aisle");
        } else {
            openCreateModal();
        }
    }, [mode, openCreateModal]);

    // Handle deleted/non-existent store
    if (!isLoading && !store) {
        showError("Store not found or no longer available.");
        history.replace("/stores");
        return null;
    }

    return (
        <IonPage>
            <RefreshConfig
                queryKeys={[
                    ["stores", storeId],
                    ["aisles", storeId],
                    ["sections", storeId],
                ]}
            >
                <AppHeader
                    title={`${store?.name || "Store"} Aisles & Sections`}
                    showBackButton
                    backButtonHref={`/stores/${encodeURIComponent(storeId)}`}
                >
                    <GlobalActions />
                </AppHeader>
                <IonContent fullscreen>
                    <PullToRefresh />
                    <AisleSectionList storeId={storeId} />
                    <FabSpacer />
                    <IonFab slot="fixed" vertical="bottom" horizontal="end">
                        <IonFabButton onClick={handleFabClick}>
                            <IonIcon icon={add} />
                        </IonFabButton>
                    </IonFab>
                </IonContent>
            </RefreshConfig>
        </IonPage>
    );
};

const StoreAislesPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    return (
        <StoreManagementProvider>
            <StoreAislesPageContent storeId={id} />
        </StoreManagementProvider>
    );
};

export default StoreAislesPage;
