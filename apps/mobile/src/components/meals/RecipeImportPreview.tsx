import { IonItem, IonLabel, IonList } from "@ionic/react";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import SkippedBadge from "../shared/SkippedBadge";
import TabEmptyState from "../shared/TabEmptyState";
import UnsureToggleButton from "../shared/UnsureToggleButton";
import type { ParsedRecipe, ParsedRecipeIngredient } from "../../llm/features/recipeImport";
import "./RecipeImportPreview.scss";

interface RecipeImportPreviewProps {
    recipe: ParsedRecipe;
    excludedIds: Set<number>;
    unsureIds: Set<number>;
    onToggleExcluded: (idx: number, excluded: boolean) => void;
    onToggleUnsure: (idx: number) => void;
}

function formatQty(ing: ParsedRecipeIngredient): string {
    if (ing.qty !== null && ing.unit) return `${ing.qty} ${ing.unit}`;
    if (ing.qty !== null) return `${ing.qty}`;
    return "";
}

const RecipeImportPreview: React.FC<RecipeImportPreviewProps> = ({
    recipe,
    excludedIds,
    unsureIds,
    onToggleExcluded,
    onToggleUnsure,
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
                Uncheck anything you don't need to buy for this recipe
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
                            <IncludeToggleButton
                                included={!excluded}
                                onClick={() => onToggleExcluded(idx, !excluded)}
                                label={ing.name}
                            />
                            <UnsureToggleButton
                                active={unsureIds.has(idx)}
                                disabled={excluded}
                                onClick={() => onToggleUnsure(idx)}
                            />
                            <IonLabel className="recipe-import-preview__row">
                                <span className="recipe-import-preview__qty">
                                    {qty || (
                                        <span className="recipe-import-preview__qty-empty">—</span>
                                    )}
                                </span>
                                <span className="recipe-import-preview__ing-name">
                                    {ing.name}
                                    {ing.excluded && <SkippedBadge />}
                                </span>
                            </IonLabel>
                        </IonItem>
                    );
                })}
            </IonList>

            {recipe.ingredients.length === 0 && (
                <TabEmptyState
                    variant="inline"
                    body="No ingredients found. Either the source hid them well, or this recipe is aspirational."
                />
            )}
        </div>
    );
};

export default RecipeImportPreview;
