import {
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonLabel,
    IonNote,
    IonPage,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonText,
} from "@ionic/react"
import { addOutline, calendarOutline, closeOutline, pricetagOutline, restaurantOutline } from "ionicons/icons"
import { Suspense, useCallback, useMemo, useState } from "react"
import { AppHeader } from "../components/layout/AppHeader"
import { LLMFabButton } from "../llm/shared"
import LoadingFallback from "../components/LoadingFallback"
import RecipeCard from "../components/meals/RecipeCard"
import RecipeEditorModal, { type RecipeInitialData } from "../components/meals/RecipeEditorModal"
import { useRecipeImportModal } from "../components/meals/useRecipeImportModal"
import TagChip from "../components/meals/TagChip"
import TagManagerModal from "../components/meals/TagManagerModal"
import { FabSpacer } from "../components/shared/FabSpacer"
import PullToRefresh from "../components/shared/PullToRefresh"
import { useAddIngredient, useCreateRecipe, usePlansHistory, useRecipes, useTags } from "../db/mealsHooks"
import { useShield } from "../components/shield/useShield"
import { useHousehold } from "../households/useHousehold"
import MealPlanWizard from "./MealPlanWizard"

import "./Meals.scss"

type Segment = "recipes" | "plans"

const RecipesContent: React.FC<{
    householdId: string | null
    onOpenEditor: (recipeId?: string) => void
    onOpenTagManager: () => void
}> = ({ householdId, onOpenEditor, onOpenTagManager }) => {
    const { data: recipes } = useRecipes(householdId)
    const { data: allTags = [] } = useTags(householdId)
    const [search, setSearch] = useState("")
    const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())

    const toggleFilterTag = (tagId: string) => {
        setActiveTagIds((prev) => {
            const next = new Set(prev)
            if (next.has(tagId)) next.delete(tagId)
            else next.add(tagId)
            return next
        })
    }

    const isFiltering = activeTagIds.size > 0

    const filtered = useMemo(() => {
        if (!recipes) return []
        let result = recipes
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            result = result.filter((r) => r.name.toLowerCase().includes(q))
        }
        if (activeTagIds.size > 0) {
            result = result.filter((r) => r.tags.some((t) => activeTagIds.has(t.id)))
        }
        return [...result].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    }, [recipes, search, activeTagIds])

    // Active tags float left; inactive follow — gives a stable, scannable order
    const sortedTags = useMemo(
        () => [
            ...allTags.filter((t) => activeTagIds.has(t.id)),
            ...allTags.filter((t) => !activeTagIds.has(t.id)),
        ],
        [allTags, activeTagIds]
    )

    if (recipes?.length === 0) {
        return (
            <div className="meals-segment-empty">
                <div className="meals-empty-icon">
                    <IonIcon icon={restaurantOutline} />
                </div>
                <IonText>
                    <h2 className="meals-empty-title">No recipes yet</h2>
                    <p className="meals-empty-body">
                        Add your first recipe to start planning meals and building shopping lists.
                    </p>
                </IonText>
                <IonButton onClick={() => onOpenEditor()}>Add Recipe</IonButton>
            </div>
        )
    }

    return (
        <>
            <div className="meals-filter-bar">
                <IonSearchbar
                    value={search}
                    onIonInput={(e) => setSearch(e.detail.value ?? "")}
                    placeholder="Search recipes"
                    debounce={150}
                />
                {(search.trim() || isFiltering) && (
                    <div className="meals-filter-count">
                        {filtered.length} recipe{filtered.length !== 1 ? "s" : ""}
                    </div>
                )}
            </div>

            <div className="meals-tag-filter">
                {/* Active-filter badge: count + tap to clear */}
                {isFiltering && (
                    <button
                        className="meals-tag-filter__badge"
                        onClick={() => setActiveTagIds(new Set())}
                        aria-label="Clear tag filters"
                    >
                        {activeTagIds.size}
                        <IonIcon icon={closeOutline} />
                    </button>
                )}

                {allTags.length > 0 ? (
                    <div className="meals-tag-filter__strip-wrap">
                        <div className="meals-tag-filter__strip">
                            {sortedTags.map((tag) => (
                                <TagChip
                                    key={tag.id}
                                    tag={tag}
                                    selected={isFiltering ? activeTagIds.has(tag.id) : undefined}
                                    onClick={() => toggleFilterTag(tag.id)}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <button
                        className="meals-tag-filter__create-hint"
                        onClick={onOpenTagManager}
                    >
                        <IonIcon icon={pricetagOutline} />
                        Create tags
                    </button>
                )}

                {allTags.length > 0 && (
                    <IonButton fill="clear" size="small" color="medium" onClick={onOpenTagManager}>
                        <IonIcon slot="icon-only" icon={pricetagOutline} />
                    </IonButton>
                )}
            </div>

            {filtered.length === 0 ? (
                <div className="meals-segment-empty">
                    <IonText>
                        <p>
                            No recipes match
                            {search.trim() ? ` "${search.trim()}"` : ""}
                            {isFiltering ? " with the active tag filters." : "."}
                        </p>
                    </IonText>
                </div>
            ) : (
                <div className="meals-recipe-grid">
                    {filtered.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            onClick={() => onOpenEditor(recipe.id)}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

const PlansContent: React.FC<{ householdId: string | null }> = ({ householdId }) => {
    const { data, isFetching, fetchNextPage, hasNextPage } = usePlansHistory(householdId)

    const plans = data?.pages.flatMap((p) => p.plans) ?? []
    const total = data?.pages[0]?.total ?? 0

    if (data !== undefined && !isFetching && plans.length === 0) {
        return (
            <div className="meals-segment-empty">
                <div className="meals-empty-icon">
                    <IonIcon icon={calendarOutline} />
                </div>
                <IonText>
                    <h2 className="meals-empty-title">No plans yet</h2>
                    <p className="meals-empty-body">
                        Run the plan wizard to pick meals and route ingredients to your shopping list.
                    </p>
                </IonText>
            </div>
        )
    }

    return (
        <div className="plans-history">
            <div className="plans-history-meta">
                {data && (
                    <IonNote>{total} dispatched plan{total !== 1 ? "s" : ""}</IonNote>
                )}
            </div>

            {plans.map((plan) => {
                const date = plan.dispatchedAt
                    ? new Date(plan.dispatchedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                      })
                    : null

                return (
                    <div key={plan.id} className="plan-history-card">
                        <div className="plan-history-card__header">
                            <span className="plan-history-card__date">{date ?? "—"}</span>
                            <span className="plan-history-card__count">
                                {plan.slotCount} meal{plan.slotCount !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div className="plan-history-card__slots">
                            {plan.slots.map((slot) => (
                                <div key={slot.slotNumber} className="plan-history-slot">
                                    <span className="plan-history-slot__num">{slot.slotNumber}</span>
                                    <span className="plan-history-slot__name">
                                        {slot.recipeName ?? <em>empty</em>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}

            {hasNextPage && (
                <div className="plans-history-more">
                    <IonButton
                        fill="clear"
                        size="small"
                        color="medium"
                        onClick={() => fetchNextPage()}
                        disabled={isFetching}
                    >
                        {isFetching ? <IonSpinner name="dots" /> : "Load more"}
                    </IonButton>
                </div>
            )}

            {isFetching && plans.length === 0 && (
                <div className="meals-segment-empty">
                    <IonSpinner />
                </div>
            )}
        </div>
    )
}

const Meals: React.FC = () => {
    const { households, activeHouseholdId, setActiveHouseholdId } = useHousehold()
    const [segment, setSegment] = useState<Segment>("recipes")
    const [wizardOpen, setWizardOpen] = useState(false)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editingRecipeId, setEditingRecipeId] = useState<string | undefined>()
    const [tagManagerOpen, setTagManagerOpen] = useState(false)

    const createRecipe = useCreateRecipe(activeHouseholdId)
    const addIngredient = useAddIngredient(activeHouseholdId)
    const { raiseShield, lowerShield } = useShield()

    const handleImportAccepted = useCallback(async (data: RecipeInitialData) => {
        const shieldId = "recipe-import-save"
        raiseShield(shieldId, "Saving recipe...")
        try {
            const recipe = await createRecipe.mutateAsync({
                name: data.name ?? "Imported Recipe",
                description: data.description ?? null,
                steps: data.steps ?? null,
                cookingTimeMinutes: data.cookingTimeMinutes ?? null,
            })
            for (let i = 0; i < (data.ingredients ?? []).length; i++) {
                const ing = data.ingredients![i]
                const qty = ing.qty.trim() ? parseFloat(ing.qty.trim()) : null
                await addIngredient.mutateAsync({
                    recipeId: recipe.id,
                    name: ing.name,
                    qty: Number.isNaN(qty) ? null : qty,
                    unitId: ing.unitId,
                    sortOrder: i,
                    excluded: ing.excluded,
                })
            }
            setEditingRecipeId(recipe.id)
            setEditorOpen(true)
        } catch {
            // errors surfaced by the mutation hooks
        } finally {
            lowerShield(shieldId)
        }
    }, [activeHouseholdId, createRecipe, addIngredient, raiseShield, lowerShield])

    const { openRecipeImport } = useRecipeImportModal(handleImportAccepted)

    const householdSelector =
        households.length > 1 ? (
            <IonSelect
                value={activeHouseholdId}
                onIonChange={(e) => setActiveHouseholdId(e.detail.value)}
                interface="action-sheet"
                className="meals-household-select"
            >
                {households.map((h) => (
                    <IonSelectOption key={h.id} value={h.id}>
                        {h.name}
                    </IonSelectOption>
                ))}
            </IonSelect>
        ) : null

    return (
        <IonPage>
            <AppHeader title="Meals">{householdSelector}</AppHeader>

            <IonSegment
                className="meals-segment-bar"
                value={segment}
                onIonChange={(e) => setSegment(e.detail.value as Segment)}
            >
                <IonSegmentButton value="recipes">
                    <IonLabel>Recipes</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="plans">
                    <IonLabel>Plans</IonLabel>
                </IonSegmentButton>
            </IonSegment>

            <IonContent className="meals-page">
                <PullToRefresh />

                {segment === "recipes" ? (
                    <Suspense fallback={<LoadingFallback />}>
                        <RecipesContent
                            householdId={activeHouseholdId}
                            onOpenEditor={(id) => {
                                setEditingRecipeId(id)
                                setEditorOpen(true)
                            }}
                            onOpenTagManager={() => setTagManagerOpen(true)}
                        />
                    </Suspense>
                ) : (
                    <PlansContent householdId={activeHouseholdId} />
                )}

                <FabSpacer />
            </IonContent>

            {segment === "recipes" && (
                <>
                    <IonFab vertical="bottom" horizontal="end" slot="fixed" className="meals-import-fab">
                        <LLMFabButton aria-label="Import recipe" onClick={openRecipeImport} />
                    </IonFab>
                    <IonFab vertical="bottom" horizontal="end" slot="fixed">
                        <IonFabButton
                            color="primary"
                            onClick={() => {
                                setEditingRecipeId(undefined)
                                setEditorOpen(true)
                            }}
                            aria-label="Add recipe"
                        >
                            <IonIcon icon={addOutline} />
                        </IonFabButton>
                    </IonFab>
                </>
            )}

            {segment === "plans" && (
                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton
                        color="primary"
                        onClick={() => setWizardOpen(true)}
                        aria-label="Start new plan"
                    >
                        <IonIcon icon={addOutline} />
                    </IonFabButton>
                </IonFab>
            )}

            <RecipeEditorModal
                isOpen={editorOpen}
                recipeId={editingRecipeId}
                householdId={activeHouseholdId}
                onDismiss={() => {
                    setEditorOpen(false)
                    setEditingRecipeId(undefined)
                }}
            />

            <TagManagerModal
                isOpen={tagManagerOpen}
                householdId={activeHouseholdId}
                onDismiss={() => setTagManagerOpen(false)}
            />

            <Suspense>
                <MealPlanWizard isOpen={wizardOpen} onDismiss={() => setWizardOpen(false)} />
            </Suspense>
        </IonPage>
    )
}

export default Meals
