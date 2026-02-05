import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import { IonContent, IonFab, IonFabButton, IonIcon, IonPage } from "@ionic/react";
import { add } from "ionicons/icons";
import { useCallback } from "react";
import { useHistory, useParams } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { FabSpacer } from "../components/shared/FabSpacer";
import AisleSectionList from "../components/store/AisleSectionList";
import { useStoreManagement } from "../components/store/StoreManagementContext";
import { StoreManagementProvider } from "../components/store/StoreManagementProvider";
import { useStore } from "../db/hooks";
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
            <AppHeader
                title={`${store?.name || "Store"} Aisles & Sections`}
                showBackButton
                backButtonHref={`/stores/${encodeURIComponent(storeId)}`}
            />
            <IonContent fullscreen>
                <AisleSectionList storeId={storeId} />
                <FabSpacer />
                <IonFab slot="fixed" vertical="bottom" horizontal="end">
                    <IonFabButton onClick={handleFabClick}>
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>
            </IonContent>
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
