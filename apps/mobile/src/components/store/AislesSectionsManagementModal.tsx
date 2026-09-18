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
import React, { useCallback, useState } from "react";
import { useStore, useStoreAisles, useUpdateAisle } from "../../db/hooks";
import { queryKeys } from "../../db/queryKeys";
import RefreshConfig from "../../hooks/refresh/RefreshConfig";
import { useToast } from "../../hooks/useToast";
import { aislesNeedingEmoji, type AisleEmojiSuggestion } from "../../llm/features/aisleEmoji";
import { useSuggestAisleEmoji } from "../../llm/features/useSuggestAisleEmoji";
import { LLMButton } from "../../llm/shared";
import { formatErrorMessage } from "../../utils/errorUtils";
import { GlobalActions } from "../layout/GlobalActions";
import { FabSpacer } from "../shared/FabSpacer";
import PullToRefresh from "../shared/PullToRefresh";
import { AisleEmojiReviewSheet } from "./AisleEmojiReviewSheet";
import AisleSectionList from "./AisleSectionList";
import { useStoreManagement } from "./StoreManagementContext";
import { StoreManagementProvider } from "./StoreManagementProvider";

interface AislesSectionsManagementModalContentProps {
    onClose: () => void;
}

const AislesSectionsManagementModalContent: React.FC<AislesSectionsManagementModalContentProps> = ({
    onClose,
}) => {
    const { storeId, openCreateModal, mode } = useStoreManagement();
    const { data: store, isLoading } = useStore(storeId);
    const { data: aisles } = useStoreAisles(storeId);
    const updateAisle = useUpdateAisle();
    const { suggestForAisles } = useSuggestAisleEmoji();
    const { showError, showSuccess } = useToast();
    const [suggestions, setSuggestions] = useState<AisleEmojiSuggestion[] | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const handleSuggestEmoji = useCallback(async () => {
        if (aislesNeedingEmoji(aisles ?? []).length === 0) {
            showSuccess("Every named aisle already has an emoji. Nothing to suggest.");
            return;
        }
        try {
            const result = await suggestForAisles(aisles ?? []);
            if (result.length === 0) {
                showError("No usable emoji came back. Try again, or set them by hand.");
                return;
            }
            setSuggestions(result);
        } catch (error) {
            showError(formatErrorMessage(error, "suggest aisle emoji"));
        }
    }, [aisles, suggestForAisles, showError, showSuccess]);

    const handleApplyEmoji = useCallback(
        async (accepted: AisleEmojiSuggestion[]) => {
            setIsApplying(true);
            let applied = 0;
            try {
                for (const suggestion of accepted) {
                    await updateAisle.mutateAsync({
                        id: suggestion.aisleId,
                        name: suggestion.name,
                        emoji: suggestion.emoji,
                        storeId,
                    });
                    applied++;
                }
                showSuccess(`Applied ${applied} emoji.`);
            } catch {
                // The failing update's toast comes from the global mutation handler.
            } finally {
                setIsApplying(false);
                setSuggestions(null);
            }
        },
        [storeId, updateAisle, showSuccess]
    );

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
                queryKeys.stores.detail(storeId),
                queryKeys.aisles.byStore(storeId),
                queryKeys.sections.byStore(storeId),
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
                <div className="aisle-emoji-suggest">
                    <LLMButton onClick={handleSuggestEmoji}>Suggest aisle emoji</LLMButton>
                </div>
                <AisleSectionList />
                <FabSpacer />
                <IonFab slot="fixed" vertical="bottom" horizontal="end">
                    <IonFabButton onClick={handleFabClick}>
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>
                <AisleEmojiReviewSheet
                    suggestions={suggestions ?? []}
                    isOpen={suggestions !== null}
                    isApplying={isApplying}
                    onApply={handleApplyEmoji}
                    onDismiss={() => setSuggestions(null)}
                />
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
            <StoreManagementProvider storeId={storeId}>
                <AislesSectionsManagementModalContent onClose={onClose} />
            </StoreManagementProvider>
        </IonModal>
    );
};

export default AislesSectionsManagementModal;
