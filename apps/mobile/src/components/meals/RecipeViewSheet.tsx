import type { RecipeWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonToolbar,
} from "@ionic/react";
import { closeOutline, copyOutline } from "ionicons/icons";
import { useToast } from "../../hooks/useToast";
import { formatRecipeAsText } from "../../utils/recipeText";
import RecipeDetailContent from "./RecipeDetailContent";

interface RecipeViewSheetProps {
    recipe: RecipeWithDetails | null;
    unitMap: Map<string, string>;
    onDismiss: () => void;
}

const RecipeViewSheet: React.FC<RecipeViewSheetProps> = ({ recipe, unitMap, onDismiss }) => {
    const { showSuccess, showError } = useToast();

    const handleCopy = async () => {
        if (!recipe) return;
        try {
            await navigator.clipboard.writeText(formatRecipeAsText(recipe, unitMap));
            showSuccess("Recipe copied");
        } catch {
            showError("Couldn't copy recipe");
        }
    };

    return (
        <IonModal
            isOpen={recipe !== null}
            onDidDismiss={onDismiss}
            breakpoints={[0, 0.85, 1]}
            initialBreakpoint={0.85}
            handle={true}
            expandToScroll={false}
        >
            {recipe && (
                <>
                    <IonHeader>
                        <IonToolbar>
                            <IonButtons slot="end">
                                <IonButton onClick={handleCopy} aria-label="Copy recipe as text">
                                    <IonIcon slot="icon-only" icon={copyOutline} />
                                </IonButton>
                                <IonButton onClick={onDismiss} aria-label="Close">
                                    <IonIcon slot="icon-only" icon={closeOutline} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        <RecipeDetailContent recipe={recipe} unitMap={unitMap} />
                    </IonContent>
                </>
            )}
        </IonModal>
    );
};

export default RecipeViewSheet;
