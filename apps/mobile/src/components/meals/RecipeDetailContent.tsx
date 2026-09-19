import type { RecipeWithDetails } from "@basket-bot/core";
import { IonIcon } from "@ionic/react";
import { listOutline, timeOutline } from "ionicons/icons";
import pluralize from "pluralize";
import { formatIngredientAmount, splitRecipeSteps } from "../../utils/recipeText";
import TagChip from "./TagChip";
import "./RecipeDetailContent.scss";

interface RecipeDetailContentProps {
    recipe: RecipeWithDetails;
    unitMap: Map<string, string>;
}

/**
 * A recipe laid out for reading while cooking: a large name, then a two-column ingredient
 * table (amounts right-aligned against the names), numbered steps and notes. Copy-as-text is
 * built from the data by formatRecipeAsText, so this layout is free to use grids.
 */
const RecipeDetailContent: React.FC<RecipeDetailContentProps> = ({ recipe, unitMap }) => {
    const steps = splitRecipeSteps(recipe.steps);
    const ingredientCount = recipe.ingredients.length;
    const hasMeta = ingredientCount > 0 || recipe.cookingTimeMinutes !== null;

    return (
        <div className="recipe-detail">
            <header className="recipe-detail__head">
                <h1 className="recipe-detail__title">{recipe.name}</h1>
                {recipe.source && <p className="recipe-detail__source">{recipe.source}</p>}
                {hasMeta && (
                    <p className="recipe-detail__meta">
                        {recipe.cookingTimeMinutes !== null && (
                            <span className="recipe-detail__meta-item">
                                <IonIcon icon={timeOutline} aria-hidden="true" />
                                {recipe.cookingTimeMinutes} min
                            </span>
                        )}
                        {ingredientCount > 0 && (
                            <span className="recipe-detail__meta-item">
                                <IonIcon icon={listOutline} aria-hidden="true" />
                                {ingredientCount} {pluralize("ingredient", ingredientCount)}
                            </span>
                        )}
                    </p>
                )}
                {recipe.tags.length > 0 && (
                    <div className="recipe-detail__tags">
                        {recipe.tags.map((tag) => (
                            <TagChip key={tag.id} tag={tag} />
                        ))}
                    </div>
                )}
            </header>

            {ingredientCount > 0 && (
                <section className="recipe-detail__section">
                    <h2 className="ruled-label recipe-detail__label">Ingredients</h2>
                    <ul className="recipe-detail__ingredients">
                        {recipe.ingredients.map((ing) => (
                            <li key={ing.id} className="recipe-detail__ingredient">
                                <span className="qty recipe-detail__amount">
                                    {formatIngredientAmount(ing.qty, ing.unitId, unitMap)}
                                </span>
                                <span className="recipe-detail__ingredient-name">
                                    {ing.name}
                                    {ing.notes && (
                                        <span className="recipe-detail__ingredient-notes">
                                            {ing.notes}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {steps.length > 0 && (
                <section className="recipe-detail__section">
                    <h2 className="ruled-label recipe-detail__label">Steps</h2>
                    {steps.length === 1 ? (
                        <p className="recipe-detail__prose">{steps[0]}</p>
                    ) : (
                        <ol className="recipe-detail__steps">
                            {steps.map((step, i) => (
                                <li key={i} className="recipe-detail__step">
                                    <span className="recipe-detail__step-num" aria-hidden="true">
                                        {i + 1}
                                    </span>
                                    <span className="recipe-detail__prose">{step}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            )}

            {recipe.description && (
                <section className="recipe-detail__section">
                    <h2 className="ruled-label recipe-detail__label">Notes</h2>
                    <p className="recipe-detail__notes">{recipe.description}</p>
                </section>
            )}
        </div>
    );
};

export default RecipeDetailContent;
