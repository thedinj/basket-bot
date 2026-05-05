import { IonCheckbox, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import type { ParsedRecipe, ParsedRecipeIngredient } from "../../llm/features/recipeImport";
import "./RecipeImportPreview.scss";

interface RecipeImportPreviewProps {
    recipe: ParsedRecipe;
    excludedIds: Set<number>;
    onToggle: (idx: number, excluded: boolean) => void;
}

function formatQty(ing: ParsedRecipeIngredient): string {
    if (ing.qty !== null && ing.unit) return `${ing.qty} ${ing.unit}`;
    if (ing.qty !== null) return `${ing.qty}`;
    return "";
}

const RecipeImportPreview: React.FC<RecipeImportPreviewProps> = ({
    recipe,
    excludedIds,
    onToggle,
}) => {
    const selectedCount = recipe.ingredients.length - excludedIds.size;

    return (
        <div className="recipe-import-preview">
            <div className="recipe-import-preview__header">
                <p className="recipe-import-preview__name">{recipe.name}</p>
                {recipe.ingredients.length > 0 && (
                    <p className="recipe-import-preview__count">
                        <span className="recipe-import-preview__count-num">{selectedCount}</span>
                        {" of "}
                        {recipe.ingredients.length} items adding to cart
                    </p>
                )}
            </div>

            <p className="recipe-import-preview__hint">
                Uncheck pantry staples to skip them when adding this recipe to your cart
            </p>

            <IonList className="recipe-import-preview__list">
                {recipe.ingredients.map((ing, idx) => {
                    const excluded = excludedIds.has(idx);
                    const qty = formatQty(ing);
                    return (
                        <IonItem
                            key={idx}
                            className={`recipe-import-preview__item${excluded ? " recipe-import-preview__item--excluded" : ""}`}
                            lines="none"
                        >
                            <IonCheckbox
                                slot="start"
                                checked={!excluded}
                                onIonChange={(e) => onToggle(idx, !e.detail.checked)}
                                aria-label={`Include ${ing.name} in shopping list`}
                            />
                            <IonLabel className="recipe-import-preview__row">
                                <span className="recipe-import-preview__qty">
                                    {qty || <span className="recipe-import-preview__qty-empty">—</span>}
                                </span>
                                <span className="recipe-import-preview__ing-name">
                                    {ing.name}
                                    {ing.isPantryItem && (
                                        <span className="recipe-import-preview__pantry-badge">
                                            pantry
                                        </span>
                                    )}
                                </span>
                            </IonLabel>
                        </IonItem>
                    );
                })}
            </IonList>

            {recipe.ingredients.length === 0 && (
                <IonText color="medium">
                    <p className="recipe-import-preview__empty">No ingredients found.</p>
                </IonText>
            )}
        </div>
    );
};

export default RecipeImportPreview;
