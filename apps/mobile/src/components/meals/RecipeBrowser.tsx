import type { RecipeWithDetails } from "@basket-bot/core";
import { IonButton } from "@ionic/react";
import pluralize from "pluralize";
import { useMemo } from "react";
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
import RecipeSearchHeader from "./RecipeSearchHeader";

/**
 * The one recipe browsing surface: search box, active-filter chips, result filtering/sorting
 * and the "nothing matched" state, shared by the Recipes tab and the meal planner.
 *
 * List rendering stays with the caller — one draws a card grid it scrolls into view, the
 * other draws tappable rows — so results come back through `children` rather than through a
 * list abstraction general enough to serve both. Search and filter state is controlled for
 * the same reason: the planner keeps a slot's filters in its own per-slot map.
 *
 * **This component deliberately does not render `RecipeFilterSheet`.** That sheet is an
 * `IonModal`, and an overlay mutates document-global state (body scroll lock, focus trap,
 * `aria-hidden` on the router outlet, backdrop and z-index stacking) that is only unwound by
 * its dismiss lifecycle. Ionic skips that lifecycle when an open overlay is unmounted
 * (`createInlineOverlayComponent.componentWillUnmount` just calls `node.remove()`), so an
 * overlay must never live inside a subtree that gets conditionally torn down — which is
 * exactly what this component's results/empty-state swap is, in two different hosts, one of
 * them nested inside another modal. Pure logic and inert presentation are safe to share; an
 * overlay is not. Each host therefore owns its own sheet and mounts it at its own stable top
 * level, and `onOpenFilters` is how this surface asks for it.
 */
interface RecipeBrowserProps {
    recipes: RecipeWithDetails[];
    query: string;
    onQueryChange: (value: string) => void;
    filters: RecipeFilters;
    sort: RecipeSort;
    onFiltersChange: (filters: RecipeFilters) => void;
    onSortChange: (sort: RecipeSort) => void;
    onReset: () => void;
    /** Asks the host to present its own `RecipeFilterSheet`. */
    onOpenFilters: () => void;
    sections?: readonly RecipeFilterSection[];
    emptyStateVariant?: "page" | "full";
    /** Replaces the generic "nothing matched" copy where the caller knows a better reason. */
    emptyStateBody?: React.ReactNode;
    children: (filtered: RecipeWithDetails[]) => React.ReactNode;
}

const RecipeBrowser: React.FC<RecipeBrowserProps> = ({
    recipes,
    query,
    onQueryChange,
    filters,
    sort,
    onFiltersChange,
    onSortChange,
    onReset,
    onOpenFilters,
    sections,
    emptyStateVariant = "page",
    emptyStateBody,
    children,
}) => {
    const filtered = useMemo(
        () => filterAndSortRecipes(recipes, { query, filters, sort }),
        [recipes, query, filters, sort]
    );

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
                onOpenFilters={onOpenFilters}
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
        </>
    );
};

export default RecipeBrowser;
