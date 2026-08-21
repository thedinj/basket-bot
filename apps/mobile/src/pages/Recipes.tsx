import type { RecipeWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonPage,
    IonSearchbar,
} from "@ionic/react";
import { addOutline, filterOutline, restaurantOutline } from "ionicons/icons";
import pluralize from "pluralize";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import LoadingFallback from "../components/LoadingFallback";
import { HouseholdSelect } from "../components/households/HouseholdSelect";
import MealsEmptyState from "../components/meals/MealsEmptyState";
import RecipeCard from "../components/meals/RecipeCard";
import RecipeEditorModal, { type RecipeInitialData } from "../components/meals/RecipeEditorModal";
import RecipeFilterSheet, {
    DEFAULT_FILTERS,
    DEFAULT_SORT,
    type RecipeFilters,
    type RecipeSort,
} from "../components/meals/RecipeFilterSheet";
import RecipeViewSheet from "../components/meals/RecipeViewSheet";
import RouteIngredientsModal from "../components/meals/RouteIngredientsModal";
import { useRecipeImportModal } from "../components/meals/useRecipeImportModal";
import { FabSpacer } from "../components/shared/FabSpacer";
import PullToRefresh from "../components/shared/PullToRefresh";
import { useShield } from "../components/shield/useShield";
import { useStores } from "../db/hooks";
import {
    useAddIngredient,
    useAddRecipeToShoppingList,
    useCreateRecipe,
    useRecipes,
    useTags,
} from "../db/mealsHooks";
import { queryKeys } from "../db/queryKeys";
import RefreshConfig from "../hooks/refresh/RefreshConfig";
import { usePreference } from "../hooks/usePreference";
import { useUnitItems } from "../hooks/useUnitItems";
import { useHousehold } from "../households/useHousehold";
import { LLMFabButton } from "../llm/shared";

import "./Recipes.scss";

const RecipesList: React.FC<{
    householdId: string | null;
    onOpenEditor: (recipeId?: string) => void;
    onAddToList: (recipe: RecipeWithDetails) => void;
    onView: (recipe: RecipeWithDetails) => void;
    scrollToRecipeId: string | null;
    onScrolledToRecipe: () => void;
}> = ({ householdId, onOpenEditor, onAddToList, onView, scrollToRecipeId, onScrolledToRecipe }) => {
    const { data: recipes } = useRecipes(householdId);
    const { data: allTags = [] } = useTags(householdId);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<RecipeFilters>(() => ({
        ...DEFAULT_FILTERS,
        tagIds: new Set(),
    }));
    const [sort, setSort] = useState<RecipeSort>(DEFAULT_SORT);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const handleReset = () => {
        setFilters({ ...DEFAULT_FILTERS, tagIds: new Set() });
        setSort(DEFAULT_SORT);
    };

    useEffect(() => {
        if (!scrollToRecipeId) return;
        setSearch("");
        handleReset();
    }, [scrollToRecipeId]);

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
            result = result.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    (r.source?.toLowerCase().includes(q) ?? false)
            );
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

    useEffect(() => {
        if (!scrollToRecipeId) return;
        const el = cardRefs.current.get(scrollToRecipeId);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        onScrolledToRecipe();
    }, [scrollToRecipeId, filtered, onScrolledToRecipe]);

    if (recipes?.length === 0) {
        return (
            <MealsEmptyState
                icon={restaurantOutline}
                title="No recipes yet"
                body="Add a recipe. The planner needs something to work with."
                action={<IonButton onClick={() => onOpenEditor()}>Add Recipe</IonButton>}
            />
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
                                {filters.tagIds.size} {pluralize("tag", filters.tagIds.size)} ×
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
                    {filtered.length} {pluralize("recipe", filtered.length)}
                </div>
            )}

            {filtered.length === 0 ? (
                <MealsEmptyState
                    body={`No recipes match${search.trim() ? ` "${search.trim()}"` : ""}${activeFilterCount > 0 ? " with the active filters." : "."}`}
                />
            ) : (
                <div className="meals-recipe-grid">
                    {filtered.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            ref={(el) => {
                                if (el) cardRefs.current.set(recipe.id, el);
                                else cardRefs.current.delete(recipe.id);
                            }}
                            recipe={recipe}
                            onClick={() => onOpenEditor(recipe.id)}
                            onAddToList={() => onAddToList(recipe)}
                            onView={() => onView(recipe)}
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

const Recipes: React.FC = () => {
    const { activeHouseholdId } = useHousehold();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingRecipeId, setEditingRecipeId] = useState<string | undefined>();
    const [routingRecipe, setRoutingRecipe] = useState<RecipeWithDetails | null>(null);
    const [viewingRecipe, setViewingRecipe] = useState<RecipeWithDetails | null>(null);
    const [scrollToRecipeId, setScrollToRecipeId] = useState<string | null>(null);
    // The import flow creates the recipe itself (not via the editor's own "new recipe"
    // save path), then opens the editor in edit mode to let the user review it — so the
    // editor's onCreated callback never fires for this recipe. Track it separately and
    // scroll to it whenever that editor session closes.
    const pendingImportScrollId = useRef<string | null>(null);

    const createRecipe = useCreateRecipe(activeHouseholdId);
    const addIngredient = useAddIngredient(activeHouseholdId);
    const { raiseShield, lowerShield } = useShield();
    const { data: stores } = useStores();
    const { value: defaultStoreValue } = usePreference("default_meal_plan_store");
    const { unitMap } = useUnitItems();
    const addToListMutation = useAddRecipeToShoppingList(activeHouseholdId, routingRecipe?.id);

    const rawIngredients = useMemo(
        () =>
            (routingRecipe?.ingredients ?? []).map((i) => {
                const hasShoppingOverride = i.shoppingQty !== null || i.shoppingUnitId !== null;
                return {
                    id: i.id,
                    recipeId: i.recipeId,
                    name: i.shoppingName ?? i.name,
                    recipeName: routingRecipe!.name,
                    qty: hasShoppingOverride ? i.shoppingQty : i.qty,
                    unitId: hasShoppingOverride ? (i.shoppingUnitId ?? null) : (i.unitId ?? null),
                    excluded: i.excluded,
                    isUnsure: !!i.isUnsure,
                };
            }),
        [routingRecipe]
    );

    const handleImportAccepted = useCallback(
        async (data: RecipeInitialData) => {
            const shieldId = "recipe-import-save";
            raiseShield(shieldId, "Saving recipe...");
            try {
                const recipe = await createRecipe.mutateAsync({
                    name: data.name ?? "Imported Recipe",
                    source: data.source ?? null,
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
                pendingImportScrollId.current = recipe.id;
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

    return (
        <RefreshConfig
            queryKeys={[
                queryKeys.recipes.byHousehold(activeHouseholdId),
                queryKeys.tags(activeHouseholdId),
            ]}
        >
            <IonPage>
                <AppHeader title="Recipes">
                    <HouseholdSelect />
                </AppHeader>

                <IonContent className="recipes-page">
                    <PullToRefresh />

                    <Suspense fallback={<LoadingFallback />}>
                        <RecipesList
                            householdId={activeHouseholdId}
                            onOpenEditor={(id) => {
                                setEditingRecipeId(id);
                                setEditorOpen(true);
                            }}
                            onAddToList={(recipe) => setRoutingRecipe(recipe)}
                            onView={(recipe) => setViewingRecipe(recipe)}
                            scrollToRecipeId={scrollToRecipeId}
                            onScrolledToRecipe={() => setScrollToRecipeId(null)}
                        />
                    </Suspense>

                    <FabSpacer />
                </IonContent>

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

                <RecipeEditorModal
                    isOpen={editorOpen}
                    recipeId={editingRecipeId}
                    householdId={activeHouseholdId}
                    onDismiss={() => {
                        setEditorOpen(false);
                        setEditingRecipeId(undefined);
                        if (pendingImportScrollId.current) {
                            setScrollToRecipeId(pendingImportScrollId.current);
                            pendingImportScrollId.current = null;
                        }
                    }}
                    onCreated={(recipeId) => setScrollToRecipeId(recipeId)}
                />

                <RouteIngredientsModal
                    isOpen={routingRecipe !== null}
                    onDismiss={() => setRoutingRecipe(null)}
                    rawIngredients={rawIngredients}
                    stores={stores}
                    initialDefaultStoreId={defaultStoreValue ?? null}
                    isWorking={addToListMutation.isPending}
                    unitMap={unitMap}
                    onConfirm={async (routes, factor) => {
                        await addToListMutation.mutateAsync({ routes, factor });
                        setRoutingRecipe(null);
                    }}
                />

                <RecipeViewSheet
                    recipe={viewingRecipe}
                    unitMap={unitMap}
                    onDismiss={() => setViewingRecipe(null)}
                />
            </IonPage>
        </RefreshConfig>
    );
};

export default Recipes;
