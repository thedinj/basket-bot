import type { RecipeTag, RecipeWithDetails } from "@basket-bot/core";
import { IonButton } from "@ionic/react";
import pluralize from "pluralize";
import { useMemo, useState } from "react";
import {
    countActiveFilters,
    type RecipeFilterSection,
    filterAndSortRecipes,
    matchesRecipeFilters,
    matchesRecipeSearchFuzzy,
    type RecipeFilters,
    type RecipeSort,
} from "../../utils/recipeSearch";
import TabEmptyState from "../shared/TabEmptyState";
import RecipeFilterSheet from "./RecipeFilterSheet";
import RecipeSearchHeader from "./RecipeSearchHeader";

/**
 * The one recipe browsing surface: search box, filter sheet, active-filter chips and the
 * "nothing matched" state, shared by the Recipes tab and the meal planner's recipe picker.
 *
 * List rendering stays with the caller — one draws a card grid it scrolls into view, the
 * other draws tappable rows — so results come back through `children` rather than through a
 * list abstraction general enough to serve both. Search and filter state is controlled for
 * the same reason: the planner keeps a slot's filters in its own per-slot map.
 */
interface RecipeBrowserProps {
    recipes: RecipeWithDetails[];
    allTags: RecipeTag[];
    query: string;
    onQueryChange: (value: string) => void;
    filters: RecipeFilters;
    sort: RecipeSort;
    onFiltersChange: (filters: RecipeFilters) => void;
    onSortChange: (sort: RecipeSort) => void;
    onReset: () => void;
    sections?: readonly RecipeFilterSection[];
    filterSheetHeading?: string;
    filterSheetPrimaryAction?: { label: string; onClick: () => void; isWorking?: boolean };
    emptyStateVariant?: "page" | "full";
    /** Replaces the generic "nothing matched" copy where the caller knows a better reason. */
    emptyStateBody?: React.ReactNode;
    children: (filtered: RecipeWithDetails[]) => React.ReactNode;
}

const RecipeBrowser: React.FC<RecipeBrowserProps> = ({
    recipes,
    allTags,
    query,
    onQueryChange,
    filters,
    sort,
    onFiltersChange,
    onSortChange,
    onReset,
    sections,
    filterSheetHeading,
    filterSheetPrimaryAction,
    emptyStateVariant = "page",
    emptyStateBody,
    children,
}) => {
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    const filtered = useMemo(
        () => filterAndSortRecipes(recipes, { query, filters, sort }),
        [recipes, query, filters, sort]
    );

    const hasPoolExcludedRecipes = useMemo(() => recipes.some((r) => r.isPoolExcluded), [recipes]);

    const activeFilterCount = countActiveFilters(filters, sort, sections);
    const trimmedQuery = query.trim();

    // When nothing matched, separate "no such recipe" from "your filters are hiding it" —
    // the second is recoverable, and saying so beats making the user guess which it was.
    // Only worth computing in the empty case.
    const hiddenByFilters = useMemo(() => {
        if (filtered.length > 0 || activeFilterCount === 0) return 0;
        return recipes.filter(
            (r) => matchesRecipeSearchFuzzy(r, query) && !matchesRecipeFilters(r, filters)
        ).length;
    }, [filtered.length, activeFilterCount, recipes, query, filters]);

    return (
        <>
            <RecipeSearchHeader
                query={query}
                onQueryChange={onQueryChange}
                filters={filters}
                sort={sort}
                onFiltersChange={onFiltersChange}
                onSortChange={onSortChange}
                onOpenFilters={() => setFilterSheetOpen(true)}
                onReset={onReset}
                resultCount={filtered.length}
                sections={sections}
            />

            {filtered.length === 0 ? (
                <TabEmptyState
                    variant={emptyStateVariant}
                    body={
                        emptyStateBody ??
                        (hiddenByFilters > 0
                            ? `${hiddenByFilters} ${pluralize("recipe", hiddenByFilters)} ` +
                              `${hiddenByFilters === 1 ? "matches" : "match"}` +
                              `${trimmedQuery ? ` "${trimmedQuery}"` : ""}, but your filters rule ` +
                              `${hiddenByFilters === 1 ? "it" : "them"} out.`
                            : `No recipes match${trimmedQuery ? ` "${trimmedQuery}"` : ""}.`)
                    }
                    action={
                        !emptyStateBody && hiddenByFilters > 0 ? (
                            <IonButton fill="outline" size="small" onClick={onReset}>
                                Clear filters
                            </IonButton>
                        ) : undefined
                    }
                />
            ) : (
                children(filtered)
            )}

            <RecipeFilterSheet
                isOpen={filterSheetOpen}
                filters={filters}
                sort={sort}
                allTags={allTags}
                hasPoolExcludedRecipes={hasPoolExcludedRecipes}
                onFiltersChange={onFiltersChange}
                onSortChange={onSortChange}
                onReset={onReset}
                onDismiss={() => setFilterSheetOpen(false)}
                sections={sections}
                heading={filterSheetHeading}
                primaryAction={
                    filterSheetPrimaryAction && {
                        ...filterSheetPrimaryAction,
                        // Close before acting: the action can tear down whatever hosts this
                        // sheet, and unmounting a parent modal around an open child leaves a
                        // stuck backdrop.
                        onClick: () => {
                            setFilterSheetOpen(false);
                            filterSheetPrimaryAction.onClick();
                        },
                    }
                }
            />
        </>
    );
};

export default RecipeBrowser;
