import type { RecipeTag, RecipeWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonIcon,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import pluralize from "pluralize";
import { useMemo, useState } from "react";
import {
    DEFAULT_FILTERS,
    DEFAULT_SORT,
    matchesRecipeFilters,
    matchesRecipeSearchFuzzy,
    type RecipeFilters,
    type RecipeSort,
} from "../../utils/recipeSearch";
import RecipeBrowser from "./RecipeBrowser";
import RecipeFilterSheet from "./RecipeFilterSheet";
import TagChipList from "./TagChipList";

import "./RecipePickerModal.scss";

/**
 * Browse and pick a recipe for a meal-plan slot.
 *
 * Search, filtering and sorting come from the same `RecipeBrowser` the Recipes tab uses, so
 * the two surfaces behave identically.
 *
 * Everything here is throwaway: the only thing this modal reports back is whether a recipe
 * was picked. Filters are seeded from the slot so browsing starts somewhere sensible, but
 * edits stay local and are discarded on close — the slot's own filter button is what edits
 * the filters the plan persists and the server rerolls against.
 *
 * The planner only ever draws from the randomizer pool (the server's own candidate query
 * requires `isPoolExcluded IS NULL`), so `inPoolOnly` is pinned on here and the "pool"
 * section is never offered — otherwise the picker would list recipes no plan can use.
 */
const poolOnly = (f: RecipeFilters): RecipeFilters => ({ ...f, inPoolOnly: true });

interface RecipePickerModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    recipes: RecipeWithDetails[];
    allTags: RecipeTag[];
    onPick: (recipe: RecipeWithDetails) => void;
    initialFilters: RecipeFilters;
    slotNumber: number | null;
    title?: string;
}

const RecipePickerModal: React.FC<RecipePickerModalProps> = ({
    isOpen,
    onDismiss,
    recipes,
    allTags,
    onPick,
    initialFilters,
    slotNumber,
    title = "Pick a recipe",
}) => {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<RecipeSort>(DEFAULT_SORT);
    const [filters, setFilters] = useState<RecipeFilters>(() => poolOnly(initialFilters));
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    // Reseed from the slot each time the picker opens, so a previous visit's abandoned
    // edits never leak into the next one.
    const handleWillPresent = () => {
        setQuery("");
        setSort(DEFAULT_SORT);
        setFilters(poolOnly(initialFilters));
        setFilterSheetOpen(false);
    };

    // How many recipes the pool pin is the *only* thing hiding. Searching for a recipe you
    // know exists and getting a bare "no matches" is the trap this surface would otherwise
    // set, so when that happens the empty state names the real reason.
    const benchedCount = useMemo(
        () =>
            recipes.filter(
                (r) =>
                    r.isPoolExcluded &&
                    matchesRecipeSearchFuzzy(r, query) &&
                    matchesRecipeFilters(r, { ...filters, inPoolOnly: false })
            ).length,
        [recipes, query, filters]
    );

    const isNarrowed =
        !!query.trim() || filters.tagIds.size > 0 || filters.maxCookingTimeMinutes !== null;
    const benchedBody =
        benchedCount === 0
            ? undefined
            : isNarrowed
              ? `${benchedCount} ${pluralize("recipe", benchedCount)} ${benchedCount === 1 ? "matches" : "match"}, but the randomizer pool leaves ${benchedCount === 1 ? "it" : "them"} out. The planner only deals in pool recipes — change that on the Recipes tab.`
              : "Every recipe here sits outside the randomizer pool. The planner only deals in pool recipes — change that on the Recipes tab.";

    // Both exits tear this modal down, and the filter sheet is a child overlay: close it
    // through its own dismiss lifecycle first, because Ionic skips that lifecycle when an
    // open overlay is simply unmounted (see the note on RecipeBrowser).
    const handleDismiss = () => {
        setFilterSheetOpen(false);
        setQuery("");
        onDismiss();
    };

    const handlePick = (recipe: RecipeWithDetails) => {
        setFilterSheetOpen(false);
        setQuery("");
        onPick(recipe);
    };

    return (
        <IonModal isOpen={isOpen} onWillPresent={handleWillPresent} onDidDismiss={handleDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{title}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleDismiss}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <RecipeBrowser
                    recipes={recipes}
                    query={query}
                    onQueryChange={setQuery}
                    filters={filters}
                    sort={sort}
                    onFiltersChange={(next) => setFilters(poolOnly(next))}
                    onSortChange={setSort}
                    onReset={() => setFilters(poolOnly(DEFAULT_FILTERS))}
                    onOpenFilters={() => setFilterSheetOpen(true)}
                    sections={["sort", "time", "tags"]}
                    emptyStateVariant="full"
                    emptyStateBody={benchedBody}
                >
                    {(filtered) => (
                        <IonList>
                            {filtered.map((recipe) => (
                                <IonItem
                                    key={recipe.id}
                                    button
                                    detail={false}
                                    onClick={() => handlePick(recipe)}
                                >
                                    <IonLabel>
                                        <h3>{recipe.name}</h3>
                                        {recipe.source && (
                                            <p className="recipe-picker-item-source">
                                                {recipe.source}
                                            </p>
                                        )}
                                        {recipe.tags.length > 0 && (
                                            <TagChipList
                                                tags={recipe.tags}
                                                max={4}
                                                className="recipe-picker-item-tags"
                                            />
                                        )}
                                    </IonLabel>
                                </IonItem>
                            ))}
                        </IonList>
                    )}
                </RecipeBrowser>
            </IonContent>

            {/* Mounted here, as a sibling of IonContent, so it is outside the subtree that
                swaps between the recipe list and the empty state. */}
            <RecipeFilterSheet
                isOpen={filterSheetOpen}
                filters={filters}
                sort={sort}
                allTags={allTags}
                hasPoolExcludedRecipes={false}
                onFiltersChange={(next) => setFilters(poolOnly(next))}
                onSortChange={setSort}
                onReset={() => setFilters(poolOnly(DEFAULT_FILTERS))}
                onDismiss={() => setFilterSheetOpen(false)}
                sections={["sort", "time", "tags"]}
                heading={slotNumber !== null ? `Slot ${slotNumber}` : undefined}
            />
        </IonModal>
    );
};

export default RecipePickerModal;
