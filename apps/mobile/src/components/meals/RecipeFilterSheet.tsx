import {
    IonButton,
    IonContent,
    IonFooter,
    IonModal,
    IonToggle,
    IonToolbar,
} from "@ionic/react"
import type { RecipeTag } from "@basket-bot/core"
import TagChip from "./TagChip"

import "./RecipeFilterSheet.scss"

export interface RecipeFilters {
    tagIds: Set<string>
    tagMode: "any" | "all"
    maxCookingTimeMinutes: number | null
    inPoolOnly: boolean
    hasSteps: boolean
}

export interface RecipeSort {
    by: "name" | "cookTime" | "ingredientCount" | "dateAdded"
    dir: "asc" | "desc"
}

export const DEFAULT_FILTERS: RecipeFilters = {
    tagIds: new Set(),
    tagMode: "any",
    maxCookingTimeMinutes: null,
    inPoolOnly: false,
    hasSteps: false,
}

export const DEFAULT_SORT: RecipeSort = { by: "name", dir: "asc" }

interface RecipeFilterSheetProps {
    isOpen: boolean
    filters: RecipeFilters
    sort: RecipeSort
    allTags: RecipeTag[]
    hasPoolExcludedRecipes: boolean
    onFiltersChange: (f: RecipeFilters) => void
    onSortChange: (s: RecipeSort) => void
    onReset: () => void
    onDismiss: () => void
}

const SORT_FIELDS: { value: RecipeSort["by"]; label: string }[] = [
    { value: "name",             label: "Name"        },
    { value: "cookTime",         label: "Cook time"   },
    { value: "ingredientCount",  label: "Ingredients" },
    { value: "dateAdded",        label: "Date added"  },
]

const TIME_PRESETS = [15, 30, 60] as const

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
}) => {
    const setTagMode  = (m: "any" | "all") => onFiltersChange({ ...filters, tagMode: m })
    const toggleTag   = (id: string) => {
        const next = new Set(filters.tagIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onFiltersChange({ ...filters, tagIds: next })
    }
    const setMaxTime  = (v: number | null) => onFiltersChange({ ...filters, maxCookingTimeMinutes: v })
    const setInPool   = (v: boolean) => onFiltersChange({ ...filters, inPoolOnly: v })
    const setHasSteps = (v: boolean) => onFiltersChange({ ...filters, hasSteps: v })
    const setSortBy   = (by: RecipeSort["by"]) => onSortChange({ ...sort, by })
    const toggleDir   = () => onSortChange({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={onDismiss}
            breakpoints={[0, 0.92]}
            initialBreakpoint={0.92}
            handle
        >
            <IonContent className="recipe-filter-sheet">

                {/* ── Sort ──────────────────────────────────────────────────── */}
                <div className="recipe-filter-sheet__section">
                    <p className="recipe-filter-sheet__section-label">Sort</p>
                    <div className="recipe-filter-sheet__sort-row">
                        <div className="recipe-filter-sheet__sort-chips">
                            {SORT_FIELDS.map((f) => (
                                <button
                                    key={f.value}
                                    type="button"
                                    className={`recipe-filter-sheet__sort-chip${sort.by === f.value ? " active" : ""}`}
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
                            aria-label={sort.dir === "asc" ? "Ascending, tap to reverse" : "Descending, tap to reverse"}
                        >
                            {sort.dir === "asc" ? "↑ Asc" : "↓ Desc"}
                        </button>
                    </div>
                </div>

                {/* ── Cook time ─────────────────────────────────────────────── */}
                <div className="recipe-filter-sheet__section">
                    <p className="recipe-filter-sheet__section-label">Max cook time</p>
                    <div className="recipe-filter-sheet__time-section">
                        <div className="recipe-filter-sheet__time-presets">
                            {TIME_PRESETS.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    className={`recipe-filter-sheet__time-preset${filters.maxCookingTimeMinutes === t ? " active" : ""}`}
                                    onClick={() => setMaxTime(filters.maxCookingTimeMinutes === t ? null : t)}
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
                            <span className="recipe-filter-sheet__time-label">Custom max</span>
                            <div className="recipe-filter-sheet__time-input-wrap">
                                <input
                                    type="number"
                                    className="recipe-filter-sheet__time-input"
                                    value={filters.maxCookingTimeMinutes ?? ""}
                                    onChange={(e) => {
                                        const raw = e.target.value
                                        const parsed = raw.trim() ? parseInt(raw, 10) : null
                                        const val = parsed !== null && !Number.isNaN(parsed)
                                            ? Math.max(1, parsed)
                                            : null
                                        setMaxTime(val)
                                    }}
                                    placeholder="—"
                                    min={1}
                                />
                                <span className="recipe-filter-sheet__time-unit">min</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Tags ──────────────────────────────────────────────────── */}
                <div className="recipe-filter-sheet__section">
                    <div className="recipe-filter-sheet__tags-header">
                        <p className="recipe-filter-sheet__section-label">Tags</p>
                        {allTags.length > 0 && (
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
                                        selected={filters.tagIds.size > 0
                                            ? filters.tagIds.has(tag.id)
                                            : undefined}
                                    />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="recipe-filter-sheet__tags-empty">No tags yet.</p>
                    )}
                </div>

                {/* ── Pool filter ───────────────────────────────────────────── */}
                {hasPoolExcludedRecipes && (
                    <div className="recipe-filter-sheet__section">
                        <p className="recipe-filter-sheet__section-label">Randomizer pool</p>
                        <div className="recipe-filter-sheet__toggle-row">
                            <span className="recipe-filter-sheet__toggle-label">In-pool recipes only</span>
                            <IonToggle
                                checked={filters.inPoolOnly}
                                onIonChange={(e) => setInPool(e.detail.checked)}
                            />
                        </div>
                    </div>
                )}

                {/* ── Has steps ─────────────────────────────────────────────── */}
                <div className="recipe-filter-sheet__section">
                    <p className="recipe-filter-sheet__section-label">Instructions</p>
                    <div className="recipe-filter-sheet__toggle-row">
                        <span className="recipe-filter-sheet__toggle-label">Has cooking instructions</span>
                        <IonToggle
                            checked={filters.hasSteps}
                            onIonChange={(e) => setHasSteps(e.detail.checked)}
                        />
                    </div>
                </div>

            </IonContent>

            <IonFooter className="recipe-filter-sheet-footer">
                <IonToolbar>
                    <div className="recipe-filter-sheet__footer">
                        <IonButton fill="outline" color="medium" onClick={onReset}>
                            Reset
                        </IonButton>
                        <IonButton onClick={onDismiss}>Done</IonButton>
                    </div>
                </IonToolbar>
            </IonFooter>
        </IonModal>
    )
}

export default RecipeFilterSheet
