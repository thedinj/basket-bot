import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
} from "@ionic/react"
import { useMemo, useState } from "react"
import { useHistory, useParams } from "react-router-dom"
import RecipeDetailContent from "../components/meals/RecipeDetailContent"
import RecipeEditorModal from "../components/meals/RecipeEditorModal"
import { useQuantityUnits } from "../db/hooks"
import { useRecipe } from "../db/mealsHooks"
import { useHousehold } from "../households/useHousehold"

import "./RecipeDetail.scss"

const RecipeDetail: React.FC = () => {
    const { recipeId } = useParams<{ recipeId: string }>()
    const history = useHistory()
    const { activeHouseholdId } = useHousehold()
    const { data: recipe, isLoading } = useRecipe(activeHouseholdId, recipeId)
    const { data: units } = useQuantityUnits()
    const [editorOpen, setEditorOpen] = useState(false)

    const unitMap = useMemo(
        () => new Map(units?.map((u) => [u.id, u.abbreviation]) ?? []),
        [units],
    )

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/meals" />
                    </IonButtons>
                    <IonTitle>{recipe?.name ?? "Recipe"}</IonTitle>
                    {recipe && (
                        <IonButtons slot="end">
                            <IonButton onClick={() => setEditorOpen(true)}>Edit</IonButton>
                        </IonButtons>
                    )}
                </IonToolbar>
            </IonHeader>

            <IonContent className="recipe-detail-page" fullscreen>
                {isLoading && (
                    <div className="recipe-detail-loading">Loading…</div>
                )}

                {!isLoading && !recipe && (
                    <div className="recipe-detail-not-found">Recipe not found.</div>
                )}

                {recipe && <RecipeDetailContent recipe={recipe} unitMap={unitMap} />}
            </IonContent>

            <RecipeEditorModal
                isOpen={editorOpen}
                recipeId={recipeId}
                householdId={activeHouseholdId}
                onDismiss={() => setEditorOpen(false)}
                onDeleted={() => history.replace("/meals")}
            />
        </IonPage>
    )
}

export default RecipeDetail
