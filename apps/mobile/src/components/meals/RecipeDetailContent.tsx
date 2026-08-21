import type { RecipeWithDetails } from "@basket-bot/core"
import type { RefObject } from "react"
import TagChip from "./TagChip"
import "./RecipeDetailContent.scss"

interface RecipeDetailContentProps {
    recipe: RecipeWithDetails
    unitMap: Map<string, string>
    // Split in two so tags (a UI-only affordance, not part of the recipe's
    // written content) can sit between them without being picked up when
    // copying the recipe as text.
    headerRef?: RefObject<HTMLDivElement | null>
    bodyRef?: RefObject<HTMLDivElement | null>
}

const RecipeDetailContent: React.FC<RecipeDetailContentProps> = ({
    recipe,
    unitMap,
    headerRef,
    bodyRef,
}) => (
    <div className="recipe-detail-content">
        <div ref={headerRef}>
            <h1 className="recipe-detail-title">{recipe.name}</h1>
            {recipe.source && <p className="recipe-detail-source">{recipe.source}</p>}
        </div>

        {recipe.tags.length > 0 && (
            <div className="recipe-detail-tags">
                {recipe.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} />
                ))}
            </div>
        )}

        <div ref={bodyRef}>
            {recipe.ingredients.length > 0 && (
                <div className="recipe-detail-section">
                    <p className="recipe-detail-section-title">Ingredients</p>
                    {recipe.ingredients.map((ing) => (
                        <div key={ing.id} className="recipe-detail-ingredient">
                            <span className="recipe-detail-ingredient-qty">
                                {ing.qty !== null ? ing.qty : ""}
                                {ing.unitId ? ` ${unitMap.get(ing.unitId) ?? ing.unitId}` : ""}
                            </span>{" "}
                            <span className="recipe-detail-ingredient-name">{ing.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {recipe.steps && (
                <div className="recipe-detail-section">
                    <p className="recipe-detail-section-title">Steps</p>
                    <p className="recipe-detail-steps">{recipe.steps}</p>
                </div>
            )}

            {recipe.description && (
                <div className="recipe-detail-section">
                    <p className="recipe-detail-section-title">Notes</p>
                    <p className="recipe-detail-notes">{recipe.description}</p>
                </div>
            )}
        </div>
    </div>
)

export default RecipeDetailContent
