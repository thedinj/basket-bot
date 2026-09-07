import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { arrowForward } from "ionicons/icons";
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

function formatQty(qty: number | null | undefined, unit: string | null | undefined): string {
    if (qty !== null && qty !== undefined && unit) return `${qty} ${unit}`;
    if (qty !== null && qty !== undefined) return `${qty}`;
    return "";
}

/** True when the shopping-list form of the ingredient differs from the recipe's. */
function hasShoppingOverride(ing: ParsedRecipeIngredient): boolean {
    return (
        !!ing.shoppingName ||
        (ing.shoppingQty !== null && ing.shoppingQty !== undefined) ||
        !!ing.shoppingUnit
    );
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
                    const recipeQty = formatQty(ing.qty, ing.unit);
                    const shoppingOverride = hasShoppingOverride(ing);
                    const shoppingName = ing.shoppingName ?? ing.name;
                    const shoppingQty = formatQty(
                        ing.shoppingQty ?? ing.qty,
                        ing.shoppingUnit ?? ing.unit
                    );
                    return (
                        <IonItem
                            key={idx}
                            className={`recipe-import-preview__item${excluded ? " recipe-import-preview__item--excluded" : ""}`}
                            lines="none"
                        >
                            <IncludeToggleButton
                                included={!excluded}
                                onClick={() => onToggleExcluded(idx, !excluded)}
                                label={shoppingName}
                            />
                            <UnsureToggleButton
                                active={unsureIds.has(idx)}
                                onClick={() => onToggleUnsure(idx)}
                            />
                            <IonLabel className="recipe-import-preview__row">
                                <h3 className="recipe-import-preview__ing-name">
                                    {ing.name}
                                    {ing.excluded && <SkippedBadge />}
                                </h3>
                                <p className="recipe-import-preview__ing-qty">
                                    {recipeQty || (
                                        <span className="recipe-import-preview__qty-empty">—</span>
                                    )}
                                </p>
                                {shoppingOverride && (
                                    <p className="recipe-import-preview__shopping-override">
                                        <IonIcon icon={arrowForward} />
                                        {shoppingQty && (
                                            <span className="recipe-import-preview__shopping-qty">
                                                {shoppingQty}
                                            </span>
                                        )}
                                        <span className="recipe-import-preview__shopping-name">
                                            {shoppingName}
                                        </span>
                                    </p>
                                )}
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
