import { IonIcon, IonSearchbar } from "@ionic/react";
import { filterOutline } from "ionicons/icons";
import pluralize from "pluralize";
import {
    ALL_FILTER_SECTIONS,
    DEFAULT_SORT,
    countActiveFilters,
    type RecipeFilterSection,
    type RecipeFilters,
    type RecipeSort,
} from "../../utils/recipeSearch";

import "./RecipeSearchHeader.scss";

const SORT_LABELS: Record<RecipeSort["by"], string> = {
    name: "Name",
    cookTime: "Time",
    ingredientCount: "Ingr.",
    dateAdded: "Added",
};

interface RecipeSearchHeaderProps {
    query: string;
    onQueryChange: (value: string) => void;
    filters: RecipeFilters;
    sort: RecipeSort;
    onFiltersChange: (filters: RecipeFilters) => void;
    onSortChange: (sort: RecipeSort) => void;
    onOpenFilters: () => void;
    onReset: () => void;
    resultCount: number;
    sections?: readonly RecipeFilterSection[];
}

const RecipeSearchHeader: React.FC<RecipeSearchHeaderProps> = ({
    query,
    onQueryChange,
    filters,
    sort,
    onFiltersChange,
    onSortChange,
    onOpenFilters,
    onReset,
    resultCount,
    sections = ALL_FILTER_SECTIONS,
}) => {
    // A pinned filter has no chip: tapping one to clear it would be a no-op.
    const shows = (section: RecipeFilterSection) => sections.includes(section);
    const activeFilterCount = countActiveFilters(filters, sort, sections);
    const noun = pluralize("recipe", resultCount);
    const placeholder =
        activeFilterCount > 0
            ? `Search ${resultCount} matching ${noun}`
            : `Search ${resultCount} ${noun}`;

    return (
        <div className="meals-search-header">
            <div className="meals-filter-bar">
                <IonSearchbar
                    value={query}
                    onIonInput={(e) => onQueryChange(e.detail.value ?? "")}
                    placeholder={placeholder}
                    debounce={150}
                />
                <button
                    type="button"
                    className={`meals-filter-btn${activeFilterCount > 0 ? " meals-filter-btn--active" : ""}`}
                    onClick={onOpenFilters}
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
                        {shows("time") && filters.maxCookingTimeMinutes !== null && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() =>
                                    onFiltersChange({ ...filters, maxCookingTimeMinutes: null })
                                }
                            >
                                ≤{filters.maxCookingTimeMinutes}min ×
                            </button>
                        )}
                        {shows("tags") && filters.tagIds.size > 0 && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() => onFiltersChange({ ...filters, tagIds: new Set() })}
                            >
                                {filters.tagIds.size} {pluralize("tag", filters.tagIds.size)} ×
                            </button>
                        )}
                        {shows("pool") && filters.inPoolOnly && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() => onFiltersChange({ ...filters, inPoolOnly: false })}
                            >
                                In pool ×
                            </button>
                        )}
                        {shows("steps") && filters.hasSteps && (
                            <button
                                type="button"
                                className="meals-active-chip"
                                onClick={() => onFiltersChange({ ...filters, hasSteps: false })}
                            >
                                Has steps ×
                            </button>
                        )}
                        {shows("sort") &&
                            (sort.by !== DEFAULT_SORT.by || sort.dir !== DEFAULT_SORT.dir) && (
                                <button
                                    type="button"
                                    className="meals-active-chip meals-active-chip--sort"
                                    onClick={() => onSortChange(DEFAULT_SORT)}
                                >
                                    {SORT_LABELS[sort.by]} {sort.dir === "asc" ? "↑" : "↓"} ×
                                </button>
                            )}
                    </div>
                    <button
                        type="button"
                        className="meals-filter-reset"
                        onClick={onReset}
                        aria-label="Reset all filters"
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    );
};

export default RecipeSearchHeader;
