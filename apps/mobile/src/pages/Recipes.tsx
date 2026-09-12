import type { RecipeWithDetails } from "@basket-bot/core";
import { IonButton, IonContent, IonFab, IonFabButton, IonIcon, IonPage } from "@ionic/react";
import { addOutline, restaurantOutline } from "ionicons/icons";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import LoadingFallback from "../components/LoadingFallback";
import { HouseholdSelect } from "../components/households/HouseholdSelect";
import RecipeBrowser from "../components/meals/RecipeBrowser";
import RecipeCard from "../components/meals/RecipeCard";
import RecipeEditorModal, { type RecipeInitialData } from "../components/meals/RecipeEditorModal";
import RecipeFilterSheet from "../components/meals/RecipeFilterSheet";
import RecipeViewSheet from "../components/meals/RecipeViewSheet";
import RouteIngredientsModal from "../components/meals/RouteIngredientsModal";
import { useRecipeImportModal } from "../components/meals/useRecipeImportModal";
import { FabSpacer } from "../components/shared/FabSpacer";
import PullToRefresh from "../components/shared/PullToRefresh";
import TabEmptyState from "../components/shared/TabEmptyState";
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
import {
    DEFAULT_FILTERS,
    DEFAULT_SORT,
    type RecipeFilters,
    type RecipeSort,
} from "../utils/recipeSearch";

import "./Recipes.scss";

const RecipesPageContent: React.FC = () => {
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

    // The browsing surface's state lives here, alongside the filter sheet it drives, rather
    // than down in the results. The sheet is an IonModal, so it must be mounted outside the
    // IonContent whose contents get swapped between the grid and an empty state — see the
    // note on RecipeBrowser for why an overlay can't live in a tear-downable subtree.
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<RecipeFilters>(() => ({
        ...DEFAULT_FILTERS,
        tagIds: new Set(),
    }));
    const [sort, setSort] = useState<RecipeSort>(DEFAULT_SORT);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const { data: recipes } = useRecipes(activeHouseholdId);
    const { data: allTags = [] } = useTags(activeHouseholdId);
    const createRecipe = useCreateRecipe(activeHouseholdId);
    const addIngredient = useAddIngredient(activeHouseholdId);
    const { raiseShield, lowerShield } = useShield();
    const { data: stores } = useStores();
    const { value: defaultStoreValue } = usePreference("default_meal_plan_store");
    const { unitMap } = useUnitItems();
    const addToListMutation = useAddRecipeToShoppingList(activeHouseholdId, routingRecipe?.id);

    const hasPoolExcludedRecipes = useMemo(
        () => (recipes ?? []).some((r) => r.isPoolExcluded),
        [recipes]
    );

    const handleResetFilters = useCallback(() => {
        setFilters({ ...DEFAULT_FILTERS, tagIds: new Set() });
        setSort(DEFAULT_SORT);
    }, []);

    // Clear any active search/filter before scrolling, so the target recipe can't be one the
    // current filters are hiding.
    useEffect(() => {
        if (!scrollToRecipeId) return;
        setSearch("");
        handleResetFilters();
    }, [scrollToRecipeId, handleResetFilters]);

    useEffect(() => {
        if (!scrollToRecipeId) return;
        const el = cardRefs.current.get(scrollToRecipeId);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setScrollToRecipeId(null);
    }, [scrollToRecipeId, recipes, search, filters, sort]);

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
            <AppHeader title="Recipes">
                <HouseholdSelect />
            </AppHeader>

            <IonContent className="recipes-page">
                <PullToRefresh />

                {recipes.length === 0 ? (
                    <TabEmptyState
                        icon={restaurantOutline}
                        title="No recipes yet"
                        body="Add a recipe. The planner needs something to work with."
                        action={
                            <IonButton
                                onClick={() => {
                                    setEditingRecipeId(undefined);
                                    setEditorOpen(true);
                                }}
                            >
                                Add Recipe
                            </IonButton>
                        }
                    />
                ) : (
                    <RecipeBrowser
                        recipes={recipes}
                        query={search}
                        onQueryChange={setSearch}
                        filters={filters}
                        sort={sort}
                        onFiltersChange={setFilters}
                        onSortChange={setSort}
                        onReset={handleResetFilters}
                        onOpenFilters={() => setFilterSheetOpen(true)}
                    >
                        {(filtered) => (
                            <div className="meals-recipe-grid">
                                {filtered.map((recipe) => (
                                    <RecipeCard
                                        key={recipe.id}
                                        ref={(el) => {
                                            if (el) cardRefs.current.set(recipe.id, el);
                                            else cardRefs.current.delete(recipe.id);
                                        }}
                                        recipe={recipe}
                                        onClick={() => setViewingRecipe(recipe)}
                                        onAddToList={() => setRoutingRecipe(recipe)}
                                        onEdit={() => {
                                            setEditingRecipeId(recipe.id);
                                            setEditorOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </RecipeBrowser>
                )}

                <FabSpacer />
            </IonContent>

            <IonFab vertical="bottom" horizontal="end" slot="fixed" className="meals-import-fab">
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
                // `mutate` rather than `await mutateAsync`: the prop is fire-and-forget
                // (`=> void`), so a rejected `mutateAsync` became an unhandled rejection and
                // skipped the `setRoutingRecipe(null)` after it. Closing from `onSuccess`
                // instead means a failure leaves the sheet open with the user's routing
                // choices intact to retry — the toast comes from the central
                // MutationCache.onError — and can never strand an unsettled promise.
                onConfirm={(routes, factor) => {
                    addToListMutation.mutate(
                        { routes, factor },
                        { onSuccess: () => setRoutingRecipe(null) }
                    );
                }}
            />

            <RecipeViewSheet
                recipe={viewingRecipe}
                unitMap={unitMap}
                onDismiss={() => setViewingRecipe(null)}
            />

            {/* Mounted here, as a sibling of IonContent, so it is outside the subtree that
                swaps between the recipe grid and the empty state. */}
            <RecipeFilterSheet
                isOpen={filterSheetOpen}
                filters={filters}
                sort={sort}
                allTags={allTags}
                hasPoolExcludedRecipes={hasPoolExcludedRecipes}
                onFiltersChange={setFilters}
                onSortChange={setSort}
                onReset={handleResetFilters}
                onDismiss={() => setFilterSheetOpen(false)}
            />
        </RefreshConfig>
    );
};

/**
 * A tab route component MUST render its `IonPage` synchronously, before anything that can
 * suspend. Ionic's router outlet only transitions a page in once that page registers itself;
 * if the route component suspends first, no `IonPage` exists to register, the suspension
 * escapes to the app-level boundary in `App.tsx`, and hiding/re-showing the whole shell leaves
 * every page in the outlet stuck with `ion-page-invisible` — permanently. The visible symptom
 * is a blank content area whose tab buttons still update the URL but never show a page.
 *
 * So: `IonPage` first, then a Suspense boundary *inside* it, then the data. Everything that
 * suspends (`useStores`, `usePreference`) lives in `RecipesPageContent`, never here.
 * `ShoppingList` and `Plans` follow the same shape; `tabPageSuspense.test.ts` enforces it.
 */
const Recipes: React.FC = () => (
    <IonPage>
        <Suspense fallback={<LoadingFallback />}>
            <RecipesPageContent />
        </Suspense>
    </IonPage>
);

export default Recipes;
