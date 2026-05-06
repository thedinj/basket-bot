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
} from "@ionic/react";
import { addOutline, calendarOutline, filterOutline, restaurantOutline } from "ionicons/icons";
import { Suspense, useCallback, useMemo, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import LoadingFallback from "../components/LoadingFallback";
import RecipeCard from "../components/meals/RecipeCard";
import RecipeEditorModal, { type RecipeInitialData } from "../components/meals/RecipeEditorModal";
import RecipeFilterSheet, {
    DEFAULT_FILTERS,
    DEFAULT_SORT,
    type RecipeFilters,
    type RecipeSort,
} from "../components/meals/RecipeFilterSheet";
import TagManagerModal from "../components/meals/TagManagerModal";
import { useRecipeImportModal } from "../components/meals/useRecipeImportModal";
import { FabSpacer } from "../components/shared/FabSpacer";
import PullToRefresh from "../components/shared/PullToRefresh";
import { useShield } from "../components/shield/useShield";
import {
    useAddIngredient,
    useCreateRecipe,
    usePlansHistory,
    useRecipes,
    useTags,
} from "../db/mealsHooks";
import { useHousehold } from "../households/useHousehold";
import { LLMFabButton } from "../llm/shared";
import MealPlanWizard from "./MealPlanWizard";

import "./Meals.scss";

type Segment = "recipes" | "plans";

const RecipesContent: React.FC<{
    householdId: string | null;
    onOpenEditor: (recipeId?: string) => void;
}> = ({ householdId, onOpenEditor }) => {
    const { data: recipes } = useRecipes(householdId);
    const { data: allTags = [] } = useTags(householdId);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<RecipeFilters>(() => ({
        ...DEFAULT_FILTERS,
        tagIds: new Set(),
    }));
    const [sort, setSort] = useState<RecipeSort>(DEFAULT_SORT);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    const handleReset = () => {
        setFilters({ ...DEFAULT_FILTERS, tagIds: new Set() });
        setSort(DEFAULT_SORT);
    };

    const hasPoolExcludedRecipes = useMemo(
        () => (recipes ?? []).some((r) => r.isPoolExcluded),
        [recipes]
    );

    const activeFilterCount = useMemo(() => {
        let n = 0;
        if (filters.tagIds.size > 0) n++;
        if (filters.maxCookingTimeMinutes !== null) n++;
        if (filters.inPoolOnly) n++;
        if (filters.hasSteps) n++;
        if (sort.by !== "name" || sort.dir !== "asc") n++;
        return n;
    }, [filters, sort]);

    const filtered = useMemo(() => {
        if (!recipes) return [];
        let result = recipes;

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter((r) => r.name.toLowerCase().includes(q));
        }
        if (filters.tagIds.size > 0) {
            if (filters.tagMode === "any") {
                result = result.filter((r) => r.tags.some((t) => filters.tagIds.has(t.id)));
            } else {
                result = result.filter((r) =>
                    [...filters.tagIds].every((id) => r.tags.some((t) => t.id === id))
                );
            }
        }
        // Recipes with null cookingTimeMinutes are excluded when a time filter is active —
        // unknown cook time might be 3 hours, so we can't promise it fits.
        if (filters.maxCookingTimeMinutes !== null) {
            result = result.filter(
                (r) =>
                    r.cookingTimeMinutes !== null &&
                    r.cookingTimeMinutes <= filters.maxCookingTimeMinutes!
            );
        }
        if (filters.inPoolOnly) result = result.filter((r) => !r.isPoolExcluded);
        if (filters.hasSteps) result = result.filter((r) => !!r.steps?.trim());

        return [...result].sort((a, b) => {
            const d = sort.dir === "asc" ? 1 : -1;
            switch (sort.by) {
                case "name":
                    return d * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                case "cookTime": {
                    if (a.cookingTimeMinutes == null && b.cookingTimeMinutes == null) return 0;
                    if (a.cookingTimeMinutes == null) return 1;
                    if (b.cookingTimeMinutes == null) return -1;
                    return d * (a.cookingTimeMinutes - b.cookingTimeMinutes);
                }
                case "ingredientCount": {
                    const ca = a.ingredients.filter((i) => !i.excluded).length;
                    const cb = b.ingredients.filter((i) => !i.excluded).length;
                    return d * (ca - cb);
                }
                case "dateAdded":
                    return d * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            }
        });
    }, [recipes, search, filters, sort]);

    if (recipes?.length === 0) {
        return (
            <div className="meals-segment-empty">
                <div className="meals-empty-icon">
                    <IonIcon icon={restaurantOutline} />
                </div>
                <IonText>
                    <h2 className="meals-empty-title">No recipes yet</h2>
                    <p className="meals-empty-body">
                        Add a recipe. The planner needs something to work with.
                    </p>
                </IonText>
                <IonButton onClick={() => onOpenEditor()}>Add Recipe</IonButton>
            </div>
        );
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
                <button
                    type="button"
                    className={`meals-filter-btn${activeFilterCount > 0 ? " meals-filter-btn--active" : ""}`}
                    onClick={() => setFilterSheetOpen(true)}
                    aria-label="Open filter and sort options"
                >
                    <IonIcon icon={filterOutline} />
                    {activeFilterCount > 0 && (
                        <span className="meals-filter-btn__badge">{activeFilterCount}</span>
                    )}
                </button>
            </div>

            {activeFilterCount > 0 && (
                <div className="meals-filter-row">
                    <div className="meals-active-filters">
                        {filters.maxCookingTimeMinutes !== null && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() =>
                                    setFilters((f) => ({ ...f, maxCookingTimeMinutes: null }))
                                }
                            >
                                ≤{filters.maxCookingTimeMinutes}min ×
                            </button>
                        )}
                        {filters.tagIds.size > 0 && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() => setFilters((f) => ({ ...f, tagIds: new Set() }))}
                            >
                                {filters.tagIds.size} tag{filters.tagIds.size !== 1 ? "s" : ""} ×
                            </button>
                        )}
                        {filters.inPoolOnly && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() => setFilters((f) => ({ ...f, inPoolOnly: false }))}
                            >
                                In pool ×
                            </button>
                        )}
                        {filters.hasSteps && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() => setFilters((f) => ({ ...f, hasSteps: false }))}
                            >
                                Has steps ×
                            </button>
                        )}
                        {(sort.by !== "name" || sort.dir !== "asc") && (
                            <button
                                type="button"
                                className="meals-active-chip meals-active-chip--sort"
                                onClick={() => setSort(DEFAULT_SORT)}
                            >
                                {sort.by === "name"
                                    ? "Name"
                                    : sort.by === "cookTime"
                                      ? "Time"
                                      : sort.by === "ingredientCount"
                                        ? "Ingr."
                                        : "Added"}{" "}
                                {sort.dir === "asc" ? "↑" : "↓"} ×
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        className="meals-filter-reset"
                        onClick={handleReset}
                        aria-label="Reset all filters"
                    >
                        Reset
                    </button>
                </div>
            )}

            {(search.trim() || activeFilterCount > 0) && (
                <div className="meals-filter-count">
                    {filtered.length} recipe{filtered.length !== 1 ? "s" : ""}
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="meals-segment-empty">
                    <IonText>
                        <p>
                            {`No recipes match${search.trim() ? ` "${search.trim()}"` : ""}${activeFilterCount > 0 ? " with the active filters." : "."}`}
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

            <RecipeFilterSheet
                isOpen={filterSheetOpen}
                filters={filters}
                sort={sort}
                allTags={allTags}
                hasPoolExcludedRecipes={hasPoolExcludedRecipes}
                onFiltersChange={setFilters}
                onSortChange={setSort}
                onReset={handleReset}
                onDismiss={() => setFilterSheetOpen(false)}
            />
        </>
    );
};

const PlansContent: React.FC<{ householdId: string | null }> = ({ householdId }) => {
    const { data, isFetching, fetchNextPage, hasNextPage } = usePlansHistory(householdId);

    const plans = data?.pages.flatMap((p) => p.plans) ?? [];
    const total = data?.pages[0]?.total ?? 0;

    if (data !== undefined && !isFetching && plans.length === 0) {
        return (
            <div className="meals-segment-empty">
                <div className="meals-empty-icon">
                    <IonIcon icon={calendarOutline} />
                </div>
                <IonText>
                    <h2 className="meals-empty-title">No plans yet</h2>
                    <p className="meals-empty-body">
                        No dispatch history. Run the wizard when you're ready to commit.
                    </p>
                </IonText>
            </div>
        );
    }

    return (
        <div className="plans-history">
            <div className="plans-history-meta">
                {data && (
                    <IonNote>
                        {total} dispatched plan{total !== 1 ? "s" : ""}
                    </IonNote>
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
                    : null;

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
                                    <span className="plan-history-slot__num">
                                        {slot.slotNumber}
                                    </span>
                                    <span className="plan-history-slot__name">
                                        {slot.recipeName ?? <em>empty</em>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
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
    );
};

const Meals: React.FC = () => {
    const { households, activeHouseholdId, setActiveHouseholdId } = useHousehold();
    const [segment, setSegment] = useState<Segment>("recipes");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingRecipeId, setEditingRecipeId] = useState<string | undefined>();
    const [tagManagerOpen, setTagManagerOpen] = useState(false);

    const createRecipe = useCreateRecipe(activeHouseholdId);
    const addIngredient = useAddIngredient(activeHouseholdId);
    const { raiseShield, lowerShield } = useShield();

    const handleImportAccepted = useCallback(
        async (data: RecipeInitialData) => {
            const shieldId = "recipe-import-save";
            raiseShield(shieldId, "Saving recipe...");
            try {
                const recipe = await createRecipe.mutateAsync({
                    name: data.name ?? "Imported Recipe",
                    description: data.description ?? null,
                    steps: data.steps ?? null,
                    cookingTimeMinutes: data.cookingTimeMinutes ?? null,
                });
                for (let i = 0; i < (data.ingredients ?? []).length; i++) {
                    const ing = data.ingredients![i];
                    const qty = ing.qty.trim() ? parseFloat(ing.qty.trim()) : null;
                    await addIngredient.mutateAsync({
                        recipeId: recipe.id,
                        name: ing.name,
                        qty: Number.isNaN(qty) ? null : qty,
                        unitId: ing.unitId,
                        sortOrder: i,
                        excluded: ing.excluded,
                    });
                }
                setEditingRecipeId(recipe.id);
                setEditorOpen(true);
            } catch {
                // errors surfaced by the mutation hooks
            } finally {
                lowerShield(shieldId);
            }
        },
        [addIngredient, createRecipe, lowerShield, raiseShield]
    );

    const { openRecipeImport } = useRecipeImportModal(handleImportAccepted);

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
        ) : null;

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
                                setEditingRecipeId(id);
                                setEditorOpen(true);
                            }}
                        />
                    </Suspense>
                ) : (
                    <PlansContent householdId={activeHouseholdId} />
                )}

                <FabSpacer />
            </IonContent>

            {segment === "recipes" && (
                <>
                    <IonFab
                        vertical="bottom"
                        horizontal="end"
                        slot="fixed"
                        className="meals-import-fab"
                    >
                        <LLMFabButton aria-label="Import recipe" onClick={openRecipeImport} />
                    </IonFab>
                    <IonFab vertical="bottom" horizontal="end" slot="fixed">
                        <IonFabButton
                            color="primary"
                            onClick={() => {
                                setEditingRecipeId(undefined);
                                setEditorOpen(true);
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
                    setEditorOpen(false);
                    setEditingRecipeId(undefined);
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
    );
};

export default Meals;
