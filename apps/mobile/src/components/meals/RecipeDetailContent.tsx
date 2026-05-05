import type { RecipeWithDetails } from "@basket-bot/core"
import TagChip from "./TagChip"
import "../../pages/RecipeDetail.scss"

interface RecipeDetailContentProps {
    recipe: RecipeWithDetails
    unitMap: Map<string, string>
}

const RecipeDetailContent: React.FC<RecipeDetailContentProps> = ({ recipe, unitMap }) => (
    <div className="recipe-detail-content">
        {recipe.tags.length > 0 && (
            <div className="recipe-detail-tags">
                {recipe.tags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} />
                ))}
            </div>
        )}

        {recipe.ingredients.length > 0 && (
            <div className="recipe-detail-section">
                <p className="recipe-detail-section-title">Ingredients</p>
                {recipe.ingredients.map((ing) => (
                    <div key={ing.id} className="recipe-detail-ingredient">
                        <span className="recipe-detail-ingredient-qty">
                            {ing.qty !== null ? ing.qty : ""}
                            {ing.unitId ? ` ${unitMap.get(ing.unitId) ?? ing.unitId}` : ""}
                        </span>
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
)

export default RecipeDetailContent
