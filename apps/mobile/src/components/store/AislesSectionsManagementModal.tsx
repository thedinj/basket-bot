import {
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { add, closeOutline } from "ionicons/icons";
import React, { useCallback } from "react";
import { useStore } from "../../db/hooks";
import RefreshConfig from "../../hooks/refresh/RefreshConfig";
import { useToast } from "../../hooks/useToast";
import { GlobalActions } from "../layout/GlobalActions";
import { FabSpacer } from "../shared/FabSpacer";
import PullToRefresh from "../shared/PullToRefresh";
import AisleSectionList from "./AisleSectionList";
import { useStoreManagement } from "./StoreManagementContext";
import { StoreManagementProvider } from "./StoreManagementProvider";

interface AislesSectionsManagementModalContentProps {
    storeId: string;
    onClose: () => void;
}

const AislesSectionsManagementModalContent: React.FC<AislesSectionsManagementModalContentProps> = ({
    storeId,
    onClose,
}) => {
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
        onClose();
        return null;
    }

    return (
        <RefreshConfig
            queryKeys={[
                ["stores", storeId],
                ["aisles", storeId],
                ["sections", storeId],
            ]}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{store?.name || "Store"} Aisles & Sections</IonTitle>
                    <IonButtons slot="end">
                        <GlobalActions />
                        <IonButton onClick={onClose}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
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
    );
};

interface AislesSectionsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
}

const AislesSectionsManagementModal: React.FC<AislesSectionsManagementModalProps> = ({
    isOpen,
    onClose,
    storeId,
}) => {
    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            <StoreManagementProvider>
                <AislesSectionsManagementModalContent storeId={storeId} onClose={onClose} />
            </StoreManagementProvider>
        </IonModal>
    );
};

export default AislesSectionsManagementModal;
