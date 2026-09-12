import type { RecipeTag } from "@basket-bot/core";
import {
    IonButton,
    IonContent,
    IonFooter,
    IonModal,
    IonPage,
    IonSpinner,
    IonToggle,
    IonToolbar,
} from "@ionic/react";
import {
    ALL_FILTER_SECTIONS,
    DEFAULT_SORT,
    type RecipeFilterSection,
    type RecipeFilters,
    type RecipeSort,
} from "../../utils/recipeSearch";
import TagChip from "./TagChip";

import "./RecipeFilterSheet.scss";

interface RecipeFilterSheetProps {
    isOpen: boolean;
    filters: RecipeFilters;
    allTags: RecipeTag[];
    hasPoolExcludedRecipes: boolean;
    onFiltersChange: (f: RecipeFilters) => void;
    onReset: () => void;
    /** Omit both to open the sheet without a "sort" section — there is no list behind it. */
    sort?: RecipeSort;
    onSortChange?: (s: RecipeSort) => void;
    onDismiss: () => void;
    sections?: readonly RecipeFilterSection[];
    heading?: string;
    primaryAction?: { label: string; onClick: () => void; isWorking?: boolean };
}

const SORT_FIELDS: { value: RecipeSort["by"]; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "cookTime", label: "Cook time" },
    { value: "ingredientCount", label: "Ingredients" },
    { value: "dateAdded", label: "Date added" },
];

const TIME_PRESETS = [15, 30, 60] as const;

const RecipeFilterSheet: React.FC<RecipeFilterSheetProps> = ({
    isOpen,
    filters,
    sort,
    allTags,
    hasPoolExcludedRecipes,
    onFiltersChange,
    onSortChange,
    onReset,
    onDismiss,
    sections = ALL_FILTER_SECTIONS,
    heading,
    primaryAction,
}) => {
    const setTagMode = (m: "any" | "all") => onFiltersChange({ ...filters, tagMode: m });
    const toggleTag = (id: string) => {
        const next = new Set(filters.tagIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onFiltersChange({ ...filters, tagIds: next });
    };
    const setMaxTime = (v: number | null) =>
        onFiltersChange({ ...filters, maxCookingTimeMinutes: v });
    const setInPool = (v: boolean) => onFiltersChange({ ...filters, inPoolOnly: v });
    const setHasSteps = (v: boolean) => onFiltersChange({ ...filters, hasSteps: v });
    const effectiveSort = sort ?? DEFAULT_SORT;
    const setSortBy = (by: RecipeSort["by"]) => onSortChange?.({ ...effectiveSort, by });
    const toggleDir = () =>
        onSortChange?.({ ...effectiveSort, dir: effectiveSort.dir === "asc" ? "desc" : "asc" });

    const shows = (section: RecipeFilterSection) =>
        sections.includes(section) && (section !== "sort" || !!onSortChange);

    return (
        // A sheet modal's wrapper is full-height and anchored to the bottom, with the
        // breakpoint applied as translateY(8%) — so its last 8%, the footer included, sits
        // below the screen edge. `expandToScroll={false}` is what makes Ionic cap the inner
        // .ion-page at the breakpoint height and pin ion-footer to the *visible* bottom,
        // and it only finds that page box if we render an explicit IonPage.
        <IonModal
            isOpen={isOpen}
            onDidDismiss={onDismiss}
            breakpoints={[0, 0.92]}
            initialBreakpoint={0.92}
            expandToScroll={false}
            handle
        >
            <IonPage>
                <IonContent
                    className={`recipe-filter-sheet${primaryAction ? " recipe-filter-sheet--with-primary" : ""}`}
                >
                    {heading && <div className="recipe-filter-sheet__heading">{heading}</div>}

                    {/* ── Sort ──────────────────────────────────────────────────── */}
                    {shows("sort") && (
                        <div className="recipe-filter-sheet__section">
                            <p className="recipe-filter-sheet__section-label">Sort</p>
                            <div className="recipe-filter-sheet__sort-row">
                                <div className="recipe-filter-sheet__sort-chips">
                                    {SORT_FIELDS.map((f) => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            className={`recipe-filter-sheet__sort-chip${effectiveSort.by === f.value ? " active" : ""}`}
                                            onClick={() => setSortBy(f.value)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="recipe-filter-sheet__dir-btn"
                                    onClick={toggleDir}
                                    aria-label={
                                        effectiveSort.dir === "asc"
                                            ? "Ascending, tap to reverse"
                                            : "Descending, tap to reverse"
                                    }
                                >
                                    {effectiveSort.dir === "asc" ? "↑ Asc" : "↓ Desc"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Cook time ─────────────────────────────────────────────── */}
                    {shows("time") && (
                        <div className="recipe-filter-sheet__section">
                            <p className="recipe-filter-sheet__section-label">Max cook time</p>
                            <div className="recipe-filter-sheet__time-section">
                                <div className="recipe-filter-sheet__time-presets">
                                    {TIME_PRESETS.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            className={`recipe-filter-sheet__time-preset${filters.maxCookingTimeMinutes === t ? " active" : ""}`}
                                            onClick={() =>
                                                setMaxTime(
                                                    filters.maxCookingTimeMinutes === t ? null : t
                                                )
                                            }
                                        >
                                            ≤{t}m
                                        </button>
                                    ))}
                                    {filters.maxCookingTimeMinutes !== null && (
                                        <button
                                            type="button"
                                            className="recipe-filter-sheet__time-clear"
                                            onClick={() => setMaxTime(null)}
                                        >
                                            Any
                                        </button>
                                    )}
                                </div>
                                <div className="recipe-filter-sheet__time-custom-row">
                                    <span className="recipe-filter-sheet__time-label">
                                        Custom max
                                    </span>
                                    <div className="recipe-filter-sheet__time-input-wrap">
                                        <input
                                            type="number"
                                            className="recipe-filter-sheet__time-input"
                                            value={filters.maxCookingTimeMinutes ?? ""}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const parsed = raw.trim()
                                                    ? parseInt(raw, 10)
                                                    : null;
                                                const val =
                                                    parsed !== null && !Number.isNaN(parsed)
                                                        ? Math.max(1, parsed)
                                                        : null;
                                                setMaxTime(val);
                                            }}
                                            placeholder="—"
                                            min={1}
                                        />
                                        <span className="recipe-filter-sheet__time-unit">min</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tags ──────────────────────────────────────────────────── */}
                    {shows("tags") && (
                        <div className="recipe-filter-sheet__section">
                            <div className="recipe-filter-sheet__tags-header">
                                <p className="recipe-filter-sheet__section-label">
                                    {/* With the any/all control hidden the mode is fixed, so
                                        say which one is in force rather than leaving it implied. */}
                                    {shows("tagMode") ? "Tags" : `Tags · match ${filters.tagMode}`}
                                </p>
                                {allTags.length > 0 && shows("tagMode") && (
                                    <div className="recipe-filter-sheet__tag-mode">
                                        <button
                                            type="button"
                                            className={`recipe-filter-sheet__mode-btn${filters.tagMode === "any" ? " active" : ""}`}
                                            onClick={() => setTagMode("any")}
                                        >
                                            Match any
                                        </button>
                                        <button
                                            type="button"
                                            className={`recipe-filter-sheet__mode-btn${filters.tagMode === "all" ? " active" : ""}`}
                                            onClick={() => setTagMode("all")}
                                        >
                                            Match all
                                        </button>
                                    </div>
                                )}
                            </div>
                            {allTags.length > 0 ? (
                                <div className="recipe-filter-sheet__tags">
                                    {allTags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            className={`wizard-tag-btn${filters.tagIds.has(tag.id) ? " selected" : ""}`}
                                            onClick={() => toggleTag(tag.id)}
                                        >
                                            <TagChip
                                                tag={tag}
                                                selected={
                                                    filters.tagIds.size > 0
                                                        ? filters.tagIds.has(tag.id)
                                                        : undefined
                                                }
                                            />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="recipe-filter-sheet__tags-empty">No tags yet.</p>
                            )}
                        </div>
                    )}

                    {/* ── Pool filter ───────────────────────────────────────────── */}
                    {shows("pool") && hasPoolExcludedRecipes && (
                        <div className="recipe-filter-sheet__section">
                            <p className="recipe-filter-sheet__section-label">Randomizer pool</p>
                            <div className="recipe-filter-sheet__toggle-row">
                                <span className="recipe-filter-sheet__toggle-label">
                                    In-pool recipes only
                                </span>
                                <IonToggle
                                    checked={filters.inPoolOnly}
                                    onIonChange={(e) => setInPool(e.detail.checked)}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Has steps ─────────────────────────────────────────────── */}
                    {shows("steps") && (
                        <div className="recipe-filter-sheet__section">
                            <p className="recipe-filter-sheet__section-label">Instructions</p>
                            <div className="recipe-filter-sheet__toggle-row">
                                <span className="recipe-filter-sheet__toggle-label">
                                    Has cooking instructions
                                </span>
                                <IonToggle
                                    checked={filters.hasSteps}
                                    onIonChange={(e) => setHasSteps(e.detail.checked)}
                                />
                            </div>
                        </div>
                    )}
                </IonContent>

                <IonFooter className="recipe-filter-sheet-footer">
                    <IonToolbar>
                        {/* One column, not two toolbar children: ion-toolbar lays its default
                        slot out as a single fixed-height row and clips anything stacked. */}
                        <div className="recipe-filter-sheet__footer-stack">
                            {primaryAction && (
                                <IonButton
                                    expand="block"
                                    className="recipe-filter-sheet__primary"
                                    onClick={primaryAction.onClick}
                                    disabled={primaryAction.isWorking}
                                >
                                    {primaryAction.isWorking ? (
                                        <IonSpinner name="dots" />
                                    ) : (
                                        primaryAction.label
                                    )}
                                </IonButton>
                            )}
                            <div className="recipe-filter-sheet__footer">
                                <IonButton fill="outline" color="medium" onClick={onReset}>
                                    Reset
                                </IonButton>
                                <IonButton onClick={onDismiss}>Done</IonButton>
                            </div>
                        </div>
                    </IonToolbar>
                </IonFooter>
            </IonPage>
        </IonModal>
    );
};

export default RecipeFilterSheet;
