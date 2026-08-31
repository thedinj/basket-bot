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
import { useRef } from "react";
import { useToast } from "../../hooks/useToast";
import RecipeDetailContent from "./RecipeDetailContent";

interface RecipeViewSheetProps {
    recipe: RecipeWithDetails | null;
    unitMap: Map<string, string>;
    onDismiss: () => void;
}

const RecipeViewSheet: React.FC<RecipeViewSheetProps> = ({ recipe, unitMap, onDismiss }) => {
    const { showSuccess, showError } = useToast();
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const handleCopy = async () => {
        if (!headerRef.current || !bodyRef.current) return;
        try {
            const text = [headerRef.current.innerText, bodyRef.current.innerText]
                .map((section) => section.trim().replace(/\n{3,}/g, "\n\n"))
                .filter(Boolean)
                .join("\n\n");
            await navigator.clipboard.writeText(text);
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
                                <IonButton onClick={handleCopy}>
                                    <IonIcon slot="icon-only" icon={copyOutline} />
                                </IonButton>
                                <IonButton onClick={onDismiss}>
                                    <IonIcon slot="icon-only" icon={closeOutline} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        <RecipeDetailContent
                            recipe={recipe}
                            unitMap={unitMap}
                            headerRef={headerRef}
                            bodyRef={bodyRef}
                        />
                    </IonContent>
                </>
            )}
        </IonModal>
    );
};

export default RecipeViewSheet;
