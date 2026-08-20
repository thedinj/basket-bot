import type { RecipeWithDetails } from "@basket-bot/core"
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonToolbar,
} from "@ionic/react"
import { closeOutline } from "ionicons/icons"
import RecipeDetailContent from "./RecipeDetailContent"

interface RecipeViewSheetProps {
    recipe: RecipeWithDetails | null
    unitMap: Map<string, string>
    onDismiss: () => void
}

const RecipeViewSheet: React.FC<RecipeViewSheetProps> = ({ recipe, unitMap, onDismiss }) => (
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
                            <IonButton onClick={onDismiss}>
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
)

export default RecipeViewSheet
