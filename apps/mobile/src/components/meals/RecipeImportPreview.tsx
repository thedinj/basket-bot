import { IonIcon } from "@ionic/react";
import clsx from "clsx";
import { arrowForward } from "ionicons/icons";
import type { ParsedRecipe, ParsedRecipeIngredient } from "../../llm/features/recipeImport";
import { formatQuantityWithUnit } from "../../utils/quantity";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import SkippedBadge from "../shared/SkippedBadge";
import TabEmptyState from "../shared/TabEmptyState";
import UnsureToggleButton from "../shared/UnsureToggleButton";
import "./RecipeImportPreview.scss";

interface RecipeImportPreviewProps {
    recipe: ParsedRecipe;
    excludedIds: Set<number>;
    unsureIds: Set<number>;
    onToggleExcluded: (idx: number, excluded: boolean) => void;
    onToggleUnsure: (idx: number) => void;
}

/** True when the shopping-list form of the ingredient differs from the recipe's. */
const hasShoppingOverride = (ing: ParsedRecipeIngredient): boolean =>
    !!ing.shoppingName ||
    (ing.shoppingQty !== null && ing.shoppingQty !== undefined) ||
    !!ing.shoppingUnit;

/**
 * The extracted recipe, for review before it opens in the editor. Rows follow the
 * ingredient-routing list (RouteIngredientsContent): cart and unsure toggles on the gutter,
 * the name with its amount in the shopping list's quantity style, and, when the shopping list
 * will carry a different name or amount, that form as a quiet line underneath.
 */
const RecipeImportPreview: React.FC<RecipeImportPreviewProps> = ({
    recipe,
    excludedIds,
    unsureIds,
    onToggleExcluded,
    onToggleUnsure,
}) => {
    const total = recipe.ingredients.length;
    const selectedCount = total - excludedIds.size;

    return (
        <div className="recipe-import">
            <header className="recipe-import__head">
                <p className="recipe-import__name">{recipe.name}</p>
                {total > 0 && (
                    <p className="recipe-import__meta">
                        {selectedCount} of {total} items adding to cart
                    </p>
                )}
            </header>

            {total > 0 ? (
                <section className="recipe-import__group">
                    <h2 className="ruled-label">
                        Ingredients <span className="ruled-label__count">{total}</span>
                    </h2>
                    <p className="recipe-import__hint">
                        Tap a cart to skip anything you don't need to buy for this recipe.
                    </p>
                    <ul className="review-list">
                        {recipe.ingredients.map((ing, idx) => {
                            const excluded = excludedIds.has(idx);
                            const amount = formatQuantityWithUnit(ing.qty, ing.unit);
                            const shoppingOverride = hasShoppingOverride(ing);
                            const shoppingName = ing.shoppingName ?? ing.name;
                            const shoppingAmount = formatQuantityWithUnit(
                                ing.shoppingQty ?? ing.qty,
                                ing.shoppingUnit ?? ing.unit
                            );
                            return (
                                <li
                                    key={idx}
                                    className={clsx("review-row", excluded && "review-row--off")}
                                >
                                    <div className="review-row__toggles">
                                        <IncludeToggleButton
                                            included={!excluded}
                                            onClick={() => onToggleExcluded(idx, !excluded)}
                                            label={shoppingName}
                                        />
                                        <UnsureToggleButton
                                            active={unsureIds.has(idx)}
                                            onClick={() => onToggleUnsure(idx)}
                                        />
                                    </div>
                                    <p className="review-row__text">
                                        <span className="review-row__name">{ing.name}</span>
                                        {amount && <span className="qty">{amount}</span>}
                                        {ing.excluded && <SkippedBadge />}
                                        {shoppingOverride && (
                                            <span className="review-row__note recipe-import-row__buy">
                                                <IonIcon icon={arrowForward} aria-hidden="true" />
                                                <span className="sr-only">On the list as</span>
                                                {shoppingAmount && (
                                                    <span className="recipe-import-row__buy-qty">
                                                        {shoppingAmount}
                                                    </span>
                                                )}
                                                <span>{shoppingName}</span>
                                            </span>
                                        )}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ) : (
                <TabEmptyState
                    variant="inline"
                    body="No ingredients found. Either the source hid them well, or this recipe is aspirational."
                />
            )}
        </div>
    );
};

export default RecipeImportPreview;
