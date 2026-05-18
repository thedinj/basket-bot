import type { RecipeWithDetails } from "@basket-bot/core"
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon } from "@ionic/react"
import { cartOutline } from "ionicons/icons"
import { motion } from "motion/react"
import TagChipList from "./TagChipList"

import "./RecipeCard.scss"

interface RecipeCardProps {
    recipe: RecipeWithDetails
    onClick: () => void
    onAddToList?: () => void
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onClick, onAddToList }) => {
    const firstTagKey = recipe.tags[0]?.colorKey ?? null

    const cardBg = firstTagKey
        ? `linear-gradient(150deg, var(--tag-${firstTagKey}-bg) 0%, var(--ion-card-background, #1a1a2e) 65%)`
        : undefined

    const ingredientCount = recipe.ingredients.length

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.965, transition: { duration: 0.09 } }}
            className="recipe-card-motion"
        >
            <IonCard
                button
                onClick={onClick}
                className="recipe-card"
                style={cardBg ? ({ "--background": cardBg } as React.CSSProperties) : undefined}
            >
                <IonCardHeader className="recipe-card__header">
                    <IonCardTitle className="recipe-card__title">{recipe.name}</IonCardTitle>
                    {recipe.source && (
                        <p className="recipe-card__source">{recipe.source}</p>
                    )}
                    {recipe.tags.length > 0 && (
                        <TagChipList
                            tags={recipe.tags}
                            max={3}
                            className="recipe-card__tags"
                        />
                    )}
                </IonCardHeader>
                <IonCardContent className="recipe-card__content">
                    {recipe.description ? (
                        <p className="recipe-card__description">{recipe.description}</p>
                    ) : null}
                    {(ingredientCount > 0 || recipe.cookingTimeMinutes) && (
                        <div className="recipe-card__meta">
                            {ingredientCount > 0 && (
                                <span className="recipe-card__meta-item">
                                    {ingredientCount}&thinsp;{ingredientCount === 1 ? "ingredient" : "ingredients"}
                                </span>
                            )}
                            {recipe.cookingTimeMinutes && (
                                <span className="recipe-card__meta-item">
                                    {recipe.cookingTimeMinutes}&thinsp;min
                                </span>
                            )}
                        </div>
                    )}
                </IonCardContent>
                {onAddToList && (
                    <div className="recipe-card__footer">
                        <button
                            type="button"
                            className="recipe-card__add-btn"
                            onClick={(e) => {
                                e.stopPropagation()
                                onAddToList()
                            }}
                            aria-label="Add to shopping list"
                        >
                            <IonIcon icon={cartOutline} className="recipe-card__add-icon" />
                        </button>
                    </div>
                )}
            </IonCard>
        </motion.div>
    )
}

export default RecipeCard
