import type { RecipeWithDetails } from "@basket-bot/core";
import { IonCard, IonIcon } from "@ionic/react";
import { cartOutline, createOutline, listOutline, timeOutline } from "ionicons/icons";
import { motion, useReducedMotion } from "motion/react";
import pluralize from "pluralize";
import { forwardRef } from "react";
import TagChipList from "./TagChipList";

import "./RecipeCard.scss";

interface RecipeCardProps {
    recipe: RecipeWithDetails;
    onClick: () => void;
    onAddToList?: () => void;
    onEdit?: () => void;
}

/**
 * One recipe in the two-column grid. The body is the open-recipe button; the footer is a
 * separate bar of equal-width actions, so no button sits inside another. The meta line is
 * pushed to the foot of the body, so in a row of two cards the meta lines and footers align
 * however long either title runs.
 */
const RecipeCard = forwardRef<HTMLDivElement, RecipeCardProps>(
    ({ recipe, onClick, onAddToList, onEdit }, ref) => {
        const reducedMotion = useReducedMotion();
        const firstTagKey = recipe.tags[0]?.colorKey ?? null;

        const cardBg = firstTagKey
            ? `linear-gradient(150deg, var(--tag-${firstTagKey}-bg) 0%, var(--ion-card-background, #1a1a2e) 65%)`
            : undefined;

        const ingredientCount = recipe.ingredients.length;
        const hasMeta = ingredientCount > 0 || recipe.cookingTimeMinutes !== null;

        return (
            <motion.div
                ref={ref}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={
                    reducedMotion
                        ? { duration: 0.15 }
                        : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
                }
                whileTap={
                    reducedMotion ? undefined : { scale: 0.975, transition: { duration: 0.09 } }
                }
                className="recipe-card-motion"
            >
                <IonCard
                    className="recipe-card"
                    style={cardBg ? ({ "--background": cardBg } as React.CSSProperties) : undefined}
                >
                    <button type="button" className="recipe-card__body" onClick={onClick}>
                        <span className="recipe-card__title">{recipe.name}</span>
                        {recipe.source && (
                            <span className="recipe-card__source">{recipe.source}</span>
                        )}
                        {recipe.tags.length > 0 && (
                            <TagChipList tags={recipe.tags} max={3} className="recipe-card__tags" />
                        )}
                        {hasMeta && (
                            <span className="recipe-card__meta">
                                {recipe.cookingTimeMinutes !== null && (
                                    <span className="recipe-card__meta-item">
                                        <IonIcon icon={timeOutline} aria-hidden="true" />
                                        {recipe.cookingTimeMinutes} min
                                    </span>
                                )}
                                {ingredientCount > 0 && (
                                    <span className="recipe-card__meta-item">
                                        <IonIcon icon={listOutline} aria-hidden="true" />
                                        {ingredientCount}
                                        <span className="recipe-card__sr">
                                            {" "}
                                            {pluralize("ingredient", ingredientCount)}
                                        </span>
                                    </span>
                                )}
                            </span>
                        )}
                    </button>
                    {(onEdit || onAddToList) && (
                        <div className="recipe-card__footer">
                            {onEdit && (
                                <button
                                    type="button"
                                    className="recipe-card__action"
                                    onClick={onEdit}
                                    aria-label={`Edit ${recipe.name}`}
                                >
                                    <IonIcon icon={createOutline} aria-hidden="true" />
                                </button>
                            )}
                            {onAddToList && (
                                <button
                                    type="button"
                                    className="recipe-card__action"
                                    onClick={onAddToList}
                                    aria-label={`Add ${recipe.name} to shopping list`}
                                >
                                    <IonIcon icon={cartOutline} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    )}
                </IonCard>
            </motion.div>
        );
    }
);

RecipeCard.displayName = "RecipeCard";

export default RecipeCard;
