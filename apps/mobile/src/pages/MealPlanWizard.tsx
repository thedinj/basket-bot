import type { RecipeTag, RecipeWithDetails } from "@basket-bot/core";
import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonModal,
    IonPage,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import {
    addOutline,
    closeOutline,
    filterOutline,
    refreshOutline,
    removeOutline,
    searchOutline,
} from "ionicons/icons";
import pluralize from "pluralize";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import RecipeDetailContent from "../components/meals/RecipeDetailContent";
import RecipePickerModal from "../components/meals/RecipePickerModal";
import RouteIngredientsContent from "../components/meals/RouteIngredientsContent";
import ScaleFactorControl from "../components/meals/ScaleFactorControl";
import TagChip from "../components/meals/TagChip";
import { useQuantityUnits, useStores } from "../db/hooks";
import {
    useCreatePlan,
    useDeletePlan,
    useDispatchPlan,
    usePlan,
    usePlans,
    usePoolCount,
    useRecipes,
    useRerollSlots,
    useTags,
    useUpdatePlanRoutes,
    useUpdatePlanSlots,
} from "../db/mealsHooks";
import { usePreference } from "../hooks/usePreference";
import {
    DEFAULT_STORE,
    type ResolvedIngredient,
    useRouteIngredients,
} from "../hooks/useRouteIngredients";
import { useToast } from "../hooks/useToast";
import { useHousehold } from "../households/useHousehold";

import "./MealPlanWizard.scss";

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Pool", "Spin", "Route", "Send"] as const;

const ROBOT_QUIPS: Record<number, string> = {
    1: "> One meal. Minimal commitment. Noted.",
    2: "> Two. Technically a plan.",
    3: "> Three. I've seen worse.",
    4: "> Four. The minimum viable week.",
    5: "> Five. Bold.",
    6: "> Six. You enjoy cooking, apparently.",
    7: "> Seven. Do you even own a couch?",
    8: "> Eight. You are either organized or optimistic.",
    9: "> Nine. The whole week. Respect.",
    10: "> Ten meals. You clearly love this more than I do.",
    11: "> Eleven. Unstoppable. Slightly alarming.",
    12: "> Twelve meals. A culinary marathon. Godspeed.",
};

// ── Slot pool count (sub-component to avoid hooks-in-loop) ──────────────────

const SlotPoolCount: React.FC<{
    householdId: string | null;
    tagIds: string[];
    maxCookingTimeMinutes: number | null;
}> = ({ householdId, tagIds, maxCookingTimeMinutes }) => {
    const { data: count } = usePoolCount(householdId, tagIds, maxCookingTimeMinutes);
    if (count === undefined) return null;
    return (
        <span
            className={`wizard-slot-pool-count${count === 0 ? " wizard-slot-pool-count--empty" : ""}`}
        >
            {count === 0 ? "0 in pool" : `${count} in pool`}
        </span>
    );
};

// ── Step indicator ──────────────────────────────────────────────────────────

const StepBar: React.FC<{ step: WizardStep }> = ({ step }) => (
    <div className="wizard-step-bar">
        <div className="wizard-step-dots">
            {STEP_LABELS.map((label, i) => (
                <React.Fragment key={label}>
                    <div
                        className={`wizard-dot${i + 1 < step ? " done" : i + 1 === step ? " active" : ""}`}
                    />
                    {i < STEP_LABELS.length - 1 && <div className="wizard-dot-line" />}
                </React.Fragment>
            ))}
        </div>
        <div className="wizard-step-label">
            Step {step} / 4 — {STEP_LABELS[step - 1]}
        </div>
    </div>
);

// ── Slot filter sheet (bottom-sheet modal) ──────────────────────────────────

interface SlotFilterSheetProps {
    slotNumber: number;
    filters: { tagIds: string[]; maxCookingTimeMinutes: number | null };
    allTags: RecipeTag[];
    hasRecipe: boolean;
    isWorking: boolean;
    onToggleTag: (tagId: string) => void;
    onUpdateMaxTime: (val: number | null) => void;
    onReroll: () => void;
    onDismiss: () => void;
}

const SlotFilterSheet: React.FC<SlotFilterSheetProps> = ({
    slotNumber,
    filters,
    allTags,
    hasRecipe,
    isWorking,
    onToggleTag,
    onUpdateMaxTime,
    onReroll,
    onDismiss,
}) => (
    <IonPage>
        <IonContent className="slot-filter-sheet">
            <div className="slot-filter-sheet__heading">
                <span className="slot-filter-sheet__slot-num">Slot {slotNumber}</span>
                <span className="slot-filter-sheet__title">Filters</span>
            </div>

            {allTags.length > 0 && (
                <div className="slot-filter-sheet__section">
                    <div className="slot-filter-sheet__section-label">Tags</div>
                    <div className="slot-filter-sheet__tags">
                        {allTags.map((tag) => {
                            const selected = filters.tagIds.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    className={`wizard-tag-btn${selected ? " selected" : ""}`}
                                    onClick={() => onToggleTag(tag.id)}
                                >
                                    <TagChip tag={tag} selected={selected} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="slot-filter-sheet__section">
                <div className="slot-filter-sheet__time-row">
                    <span className="slot-filter-sheet__time-label">Max cooking time</span>
                    <div className="slot-filter-sheet__time-input-wrap">
                        <input
                            type="number"
                            className="slot-filter-sheet__time-input"
                            value={filters.maxCookingTimeMinutes ?? ""}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw.trim() ? parseInt(raw, 10) : null;
                                const val =
                                    parsed !== null && !Number.isNaN(parsed)
                                        ? Math.max(1, parsed)
                                        : null;
                                onUpdateMaxTime(val);
                            }}
                            placeholder="Any"
                            min={1}
                        />
                        <span className="slot-filter-sheet__time-unit">min</span>
                    </div>
                </div>
            </div>
        </IonContent>

        <IonFooter>
            <IonToolbar>
                <div className="slot-filter-footer-btns">
                    <IonButton expand="block" onClick={onReroll} disabled={isWorking}>
                        {isWorking ? (
                            <IonSpinner name="dots" />
                        ) : hasRecipe ? (
                            "Reroll this slot"
                        ) : (
                            "Fill this slot"
                        )}
                    </IonButton>
                    <IonButton expand="block" fill="clear" onClick={onDismiss}>
                        Done
                    </IonButton>
                </div>
            </IonToolbar>
        </IonFooter>
    </IonPage>
);

// ── Main wizard ─────────────────────────────────────────────────────────────

const MealPlanWizard: React.FC<{ isOpen: boolean; onDismiss: () => void }> = ({
    isOpen,
    onDismiss,
}) => {
    const { activeHouseholdId } = useHousehold();
    const { user } = useAuth();
    const { value: defaultMealPlanSlotsValue } = usePreference("default_meal_plan_slots");
    const { value: defaultMealPlanStoreValue } = usePreference("default_meal_plan_store");
    const { data: recipes } = useRecipes(activeHouseholdId);
    const { data: allTags = [] } = useTags(activeHouseholdId);
    const { data: stores } = useStores();
    const { data: units } = useQuantityUnits();
    const { showError } = useToast();

    const visibleStores = useMemo(() => stores.filter((s) => !s.isHidden), [stores]);
    const unitMap = useMemo(
        () => new Map(units?.map((u) => [u.id, u.abbreviation]) ?? []),
        [units]
    );

    // ── State ───────────────────────────────────────────────────────────────

    const [step, setStep] = useState<WizardStep>(1);
    const [isWorking, setIsWorking] = useState(false);

    // Step 1
    const [mealCount, setMealCount] = useState(() =>
        defaultMealPlanSlotsValue ? Number(defaultMealPlanSlotsValue) : 4
    );

    // Steps 2-4: plan from backend
    const [planId, setPlanId] = useState<string | null>(null);
    const { data: planData } = usePlan(activeHouseholdId, planId);

    // Step 2: per-slot filter state
    const [spinRevealKey, setSpinRevealKey] = useState(0);
    const [slotFilters, setSlotFilters] = useState<
        Map<number, { tagIds: string[]; maxCookingTimeMinutes: number | null }>
    >(new Map());
    const [filterPopoverSlot, setFilterPopoverSlot] = useState<number | null>(null);

    // Step 2: manual recipe picker
    const [pickerSlot, setPickerSlot] = useState<number | null>(null);
    const [showPartialAlert, setShowPartialAlert] = useState(false);

    // Step 2: recipe peek sheet
    const [peekRecipe, setPeekRecipe] = useState<RecipeWithDetails | null>(null);

    // Step 3: ingredientId → storeId | null (null = skip on dispatch)
    const routing = useRouteIngredients();
    const routeMap = routing.routeMap;
    const setRouteMap = routing.setRouteMap;
    const defaultStoreId = routing.defaultStoreId;
    const [showPantryItems, setShowPantryItems] = useState(false);

    const handleToggleShowPantryItems = () => {
        setShowPantryItems((prev) => {
            const next = !prev;
            if (!next) {
                // Hiding pantry items again — uncheck any that were checked so a
                // hidden item can never be silently included in the submission.
                setRouteMap((prevMap) => {
                    const nextMap = new Map(prevMap);
                    for (const slot of planData?.slots ?? []) {
                        if (!slot.pickedRecipeId) continue;
                        const recipe = recipeById.get(slot.pickedRecipeId);
                        if (!recipe) continue;
                        for (const ing of recipe.ingredients) {
                            if (ing.excluded) nextMap.set(ing.id, null);
                        }
                    }
                    return nextMap;
                });
            }
            return next;
        });
    };

    // Step 3: per-recipe scale factors (recipeId → multiplier)
    const [scaleFactors, setScaleFactors] = useState<Map<string, number>>(new Map());
    const setFactor = (recipeId: string, f: number) =>
        setScaleFactors((prev) => new Map(prev).set(recipeId, f));

    // ── Reset each time the modal opens ────────────────────────────────────────

    const handleWillPresent = () => {
        setStep(1);
        setMealCount(defaultMealPlanSlotsValue ? Number(defaultMealPlanSlotsValue) : 4);
        setPlanId(null);
        setSpinRevealKey(0);
        setSlotFilters(new Map());
        setFilterPopoverSlot(null);
        setPickerSlot(null);
        setPeekRecipe(null);
        setScaleFactors(new Map());
        routing.init(new Map(), null);
        cleanedUp.current = false;
    };

    // ── Mutations ────────────────────────────────────────────────────────────

    const createPlanMut = useCreatePlan(activeHouseholdId);
    const deletePlanMut = useDeletePlan(activeHouseholdId);
    const updateSlotsMut = useUpdatePlanSlots(activeHouseholdId);
    const rerollMut = useRerollSlots(activeHouseholdId);
    const updateRoutesMut = useUpdatePlanRoutes(activeHouseholdId);
    const dispatchMut = useDispatchPlan(activeHouseholdId);

    // ── Orphan cleanup on mount ──────────────────────────────────────────────
    // Draft plans that were never dispatched or cancelled (e.g. browser closed)
    // accumulate in the DB. Sweep them out when the wizard opens.

    const { data: existingPlans } = usePlans(activeHouseholdId);
    const cleanedUp = useRef(false);

    useEffect(() => {
        if (cleanedUp.current || !existingPlans) return;
        cleanedUp.current = true;
        const drafts = existingPlans.filter(
            (p) => p.state === "draft" && p.createdById === user?.id
        );
        drafts.forEach((p) => {
            deletePlanMut.mutate(p.id);
        });
    }, [existingPlans]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived ──────────────────────────────────────────────────────────────

    const recipeById = useMemo(() => {
        const map = new Map<string, RecipeWithDetails>();
        recipes.forEach((r) => map.set(r.id, r));
        return map;
    }, [recipes]);

    const effectiveSlotFilters = useMemo(() => {
        const map = new Map<number, { tagIds: string[]; maxCookingTimeMinutes: number | null }>();
        for (let i = 1; i <= mealCount; i++) {
            const local = slotFilters.get(i);
            const fromBackend = planData?.slots.find((s) => s.slotNumber === i);
            map.set(
                i,
                local ?? {
                    tagIds: fromBackend?.tagIds ?? [],
                    maxCookingTimeMinutes: fromBackend?.maxCookingTimeMinutes ?? null,
                }
            );
        }
        return map;
    }, [mealCount, slotFilters, planData?.slots]);

    const slots = planData?.slots ?? [];
    const pinnedCount = slots.filter((s) => s.pinned).length;
    const filledCount = slots.filter((s) => s.pickedRecipeId != null).length;
    const allSlotsPinned = pinnedCount === mealCount && filledCount === mealCount;
    const allSlotsFilled =
        slots.length === mealCount && slots.every((s) => s.pickedRecipeId != null);
    const canReview = slots.some((s) => s.pickedRecipeId != null);

    const pickerSlotFilters =
        pickerSlot !== null
            ? (effectiveSlotFilters.get(pickerSlot) ?? { tagIds: [], maxCookingTimeMinutes: null })
            : null;
    const pickerFilterTags = useMemo(
        () =>
            pickerSlotFilters?.tagIds
                .map((id) => allTags.find((t) => t.id === id))
                .filter((t): t is NonNullable<typeof t> => t != null) ?? [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pickerSlot, allTags, effectiveSlotFilters]
    );
    const pickerRecipes = useMemo(() => {
        if (!pickerSlotFilters) return recipes;
        const { tagIds, maxCookingTimeMinutes } = pickerSlotFilters;
        return recipes.filter((r) => {
            if (tagIds.length > 0 && !tagIds.every((id) => r.tags.some((t) => t.id === id)))
                return false;
            if (
                maxCookingTimeMinutes != null &&
                r.cookingTimeMinutes != null &&
                r.cookingTimeMinutes > maxCookingTimeMinutes
            )
                return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickerSlot, recipes, effectiveSlotFilters]);

    const routeIngredients = useMemo(() => {
        if (!planData) return [];
        const result: ResolvedIngredient[] = [];
        for (const slot of planData.slots) {
            if (!slot.pickedRecipeId) continue;
            const recipe = recipeById.get(slot.pickedRecipeId);
            if (!recipe) continue;
            const factor = scaleFactors.get(recipe.id) ?? 1;
            for (const ing of recipe.ingredients) {
                const raw = routeMap.get(ing.id) ?? null;
                result.push({
                    ingredientId: ing.id,
                    recipeId: recipe.id,
                    name: ing.name,
                    recipeName: recipe.name,
                    storeId: raw === DEFAULT_STORE ? (defaultStoreId ?? null) : raw,
                    qty: ing.qty,
                    scaledQty:
                        ing.qty != null ? parseFloat((ing.qty * factor).toPrecision(4)) : null,
                    unitId: ing.unitId ?? null,
                    isUnsure: routing.unsureSet.has(ing.id),
                    excluded: ing.excluded,
                });
            }
        }
        return result;
    }, [planData, recipeById, routeMap, defaultStoreId, scaleFactors, routing.unsureSet]);

    const includedCount = routeIngredients.filter((ri) => ri.storeId !== null).length;

    const pickedRecipes = useMemo(() => {
        if (!planData) return [];
        return planData.slots
            .filter((s) => s.pickedRecipeId)
            .map((s) => recipeById.get(s.pickedRecipeId!))
            .filter((r): r is RecipeWithDetails => !!r);
    }, [planData, recipeById]);

    const storeBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const ri of routeIngredients) {
            if (ri.storeId) map.set(ri.storeId, (map.get(ri.storeId) ?? 0) + 1);
        }
        return map;
    }, [routeIngredients]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const safeDeletePlan = async (id: string) => {
        try {
            await deletePlanMut.mutateAsync(id);
        } catch {
            /* empty */
        }
    };

    const handleClose = async () => {
        if (planId) await safeDeletePlan(planId);
        onDismiss();
    };

    const toggleSlotTag = (slotNumber: number, tagId: string) => {
        setSlotFilters((prev) => {
            const next = new Map(prev);
            const current = next.get(slotNumber) ?? { tagIds: [], maxCookingTimeMinutes: null };
            const tags = current.tagIds.includes(tagId)
                ? current.tagIds.filter((t) => t !== tagId)
                : [...current.tagIds, tagId];
            next.set(slotNumber, { ...current, tagIds: tags });
            return next;
        });
    };

    const updateSlotMaxTime = (slotNumber: number, val: number | null) => {
        setSlotFilters((prev) => {
            const next = new Map(prev);
            const current = next.get(slotNumber) ?? { tagIds: [], maxCookingTimeMinutes: null };
            next.set(slotNumber, { ...current, maxCookingTimeMinutes: val });
            return next;
        });
    };

    const handleNext = async () => {
        setIsWorking(true);
        try {
            if (planId) await safeDeletePlan(planId);
            const created = await createPlanMut.mutateAsync({ slotCount: mealCount });
            cleanedUp.current = true;
            setPlanId(created.id);
            setSlotFilters(new Map());
            setStep(2);
        } catch (e) {
            showError(`Failed to create plan: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setIsWorking(false);
        }
    };

    const handleRoll = async () => {
        if (!planId) return;
        setIsWorking(true);
        try {
            // Sync local filter state; preserve only pinned recipes
            const slotConfig = Array.from({ length: mealCount }, (_, i) => {
                const n = i + 1;
                const existing = planData?.slots.find((s) => s.slotNumber === n);
                const f = effectiveSlotFilters.get(n) ?? {
                    tagIds: [],
                    maxCookingTimeMinutes: null,
                };
                return {
                    slotNumber: n,
                    tagIds: f.tagIds,
                    maxCookingTimeMinutes: f.maxCookingTimeMinutes,
                    pickedRecipeId: existing?.pickedRecipeId ?? null,
                    pinned: existing?.pinned ?? false,
                };
            });
            await updateSlotsMut.mutateAsync({ planId, slots: slotConfig });
            // Roll all unpinned slots — empty or not
            const toRoll = slotConfig.filter((s) => !s.pinned).map((s) => s.slotNumber);
            if (toRoll.length > 0) {
                await rerollMut.mutateAsync({ planId, slots: toRoll });
            }
            setSpinRevealKey((k) => k + 1);
        } catch (e) {
            showError(`Failed to roll: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setIsWorking(false);
        }
    };

    const handleBackToStep1 = async () => {
        if (planId) {
            await safeDeletePlan(planId);
            setPlanId(null);
        }
        setSlotFilters(new Map());
        setStep(1);
    };

    const handleTogglePin = async (slotNumber: number, currentlyPinned: boolean) => {
        if (!planId || !planData || isWorking) return;
        setIsWorking(true);
        try {
            const updatedSlots = planData.slots.map((s) => ({
                slotNumber: s.slotNumber,
                tagIds: s.tagIds,
                maxCookingTimeMinutes: s.maxCookingTimeMinutes,
                pickedRecipeId: s.pickedRecipeId,
                pinned: s.slotNumber === slotNumber ? !currentlyPinned : s.pinned,
            }));
            await updateSlotsMut.mutateAsync({ planId, slots: updatedSlots });
        } catch (e) {
            showError(`Failed to update pin: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setIsWorking(false);
        }
    };

    const handleRerollSlotWithFilter = async (slotNumber: number) => {
        if (!planId || !planData) return;
        setIsWorking(true);
        try {
            const filters = effectiveSlotFilters.get(slotNumber) ?? {
                tagIds: [],
                maxCookingTimeMinutes: null,
            };
            const updatedSlots = planData.slots.map((s) => ({
                slotNumber: s.slotNumber,
                tagIds: s.slotNumber === slotNumber ? filters.tagIds : s.tagIds,
                maxCookingTimeMinutes:
                    s.slotNumber === slotNumber
                        ? filters.maxCookingTimeMinutes
                        : s.maxCookingTimeMinutes,
                pickedRecipeId: s.pickedRecipeId,
                pinned: s.pinned,
            }));
            await updateSlotsMut.mutateAsync({ planId, slots: updatedSlots });
            if (!planData.slots.find((s) => s.slotNumber === slotNumber)?.pinned) {
                await rerollMut.mutateAsync({ planId, slots: [slotNumber] });
            }
            setFilterPopoverSlot(null);
        } catch (e) {
            showError(
                `Failed to apply filter: ${e instanceof Error ? e.message : "Unknown error"}`
            );
        } finally {
            setIsWorking(false);
        }
    };

    const handleClearSlot = async (slotNumber: number) => {
        if (!planId || !planData || isWorking) return;
        setIsWorking(true);
        try {
            const updatedSlots = planData.slots.map((s) => ({
                slotNumber: s.slotNumber,
                tagIds: s.tagIds,
                maxCookingTimeMinutes: s.maxCookingTimeMinutes,
                pickedRecipeId: s.slotNumber === slotNumber ? null : s.pickedRecipeId,
                pinned: s.slotNumber === slotNumber ? false : s.pinned,
            }));
            await updateSlotsMut.mutateAsync({ planId, slots: updatedSlots });
        } catch (e) {
            showError(`Failed to clear slot: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setIsWorking(false);
        }
    };

    const handlePickRecipe = async (recipe: RecipeWithDetails) => {
        if (!planId || pickerSlot === null) return;
        // Build the full slot list — works whether or not the backend has slots yet
        const updatedSlots = Array.from({ length: mealCount }, (_, i) => {
            const n = i + 1;
            const existing = planData?.slots.find((s) => s.slotNumber === n);
            const f = effectiveSlotFilters.get(n) ?? { tagIds: [], maxCookingTimeMinutes: null };
            return {
                slotNumber: n,
                tagIds: f.tagIds,
                maxCookingTimeMinutes: f.maxCookingTimeMinutes,
                pickedRecipeId: n === pickerSlot ? recipe.id : (existing?.pickedRecipeId ?? null),
                pinned: n === pickerSlot ? true : (existing?.pinned ?? false),
            };
        });
        await updateSlotsMut.mutateAsync({ planId, slots: updatedSlots });
        setPickerSlot(null);
    };

    const handleGoToRoute = () => {
        if (!planData) return;

        const preferred = defaultMealPlanStoreValue
            ? (visibleStores.find((s) => s.id === defaultMealPlanStoreValue)?.id ?? null)
            : null;
        const storeId = preferred ?? visibleStores[0]?.id ?? null;
        const newMap = new Map<string, string | null>();
        const newUnsureSet = new Set<string>();

        for (const slot of planData.slots) {
            if (!slot.pickedRecipeId) continue;
            const recipe = recipeById.get(slot.pickedRecipeId);
            if (!recipe) continue;
            for (const ing of recipe.ingredients) {
                const existing = planData.routes.find((r) => r.ingredientId === ing.id);
                // Existing explicit routes keep their store; new non-pantry items default to
                // the sentinel, new pantry items default to unchecked.
                newMap.set(ing.id, existing?.storeId ?? (ing.excluded ? null : DEFAULT_STORE));
                if (existing ? existing.isUnsure : ing.isUnsure) newUnsureSet.add(ing.id);
            }
        }

        setShowPantryItems(false);
        routing.init(newMap, storeId, newUnsureSet);
        setStep(3);
    };

    const handleGoToSend = async () => {
        if (!planId) return;
        setIsWorking(true);
        try {
            const routes = routeIngredients.map((ri) => ({
                ingredientId: ri.ingredientId,
                storeId: ri.storeId,
                overridden: false,
                checked: false,
                isUnsure: ri.isUnsure,
            }));
            await updateRoutesMut.mutateAsync({ planId, routes });
            setStep(4);
        } catch (e) {
            showError(`Failed to save routes: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setIsWorking(false);
        }
    };

    const handleDispatch = async () => {
        if (!planId) return;
        setIsWorking(true);
        try {
            await dispatchMut.mutateAsync({
                planId,
                scaleFactors: Object.fromEntries(scaleFactors),
            });
            onDismiss();
        } catch (e) {
            showError(`Failed to dispatch: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setIsWorking(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <IonModal isOpen={isOpen} onWillPresent={handleWillPresent} backdropDismiss={false}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Plan meals</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleClose} disabled={isWorking}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="wizard-content">
                <StepBar step={step} />

                {/* ── Step 1: Pool ─────────────────────────────────────────── */}
                {step === 1 && (
                    <>
                        <div className="wizard-section-title">How many meals?</div>
                        <div className="wizard-count-row">
                            <IonButton
                                fill="outline"
                                shape="round"
                                onClick={() => setMealCount((n) => Math.max(1, n - 1))}
                                disabled={mealCount <= 1}
                            >
                                <IonIcon slot="icon-only" icon={removeOutline} />
                            </IonButton>
                            <span className="wizard-count-val">{mealCount}</span>
                            <IonButton
                                fill="outline"
                                shape="round"
                                onClick={() => setMealCount((n) => Math.min(12, n + 1))}
                                disabled={mealCount >= 12}
                            >
                                <IonIcon slot="icon-only" icon={addOutline} />
                            </IonButton>
                        </div>
                        <div className="wizard-robot-line">{ROBOT_QUIPS[mealCount]}</div>
                    </>
                )}

                {/* ── Step 2: Spin ─────────────────────────────────────────── */}
                {step === 2 && (
                    <>
                        <div className="wizard-spin-header">
                            <span className="wizard-spin-meta">
                                {filledCount} / {mealCount} filled
                                {pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ""}
                            </span>
                            <IonButton
                                fill="clear"
                                size="small"
                                onClick={handleRoll}
                                disabled={isWorking || !planId || allSlotsPinned}
                            >
                                <IonIcon slot="start" icon={refreshOutline} />
                                {filledCount === 0 ? "Roll" : "Roll unpinned"}
                            </IonButton>
                        </div>

                        {Array.from({ length: mealCount }, (_, i) => i + 1).map((slotNumber) => {
                            const slot = planData?.slots.find((s) => s.slotNumber === slotNumber);
                            const recipe = slot?.pickedRecipeId
                                ? recipeById.get(slot.pickedRecipeId)
                                : undefined;
                            const filters = effectiveSlotFilters.get(slotNumber) ?? {
                                tagIds: [],
                                maxCookingTimeMinutes: null,
                            };
                            const firstTagKey = recipe?.tags[0]?.colorKey ?? null;
                            const cardBg = firstTagKey
                                ? `linear-gradient(150deg, var(--tag-${firstTagKey}-bg) 0%, var(--ion-card-background, #1a1a2e) 60%)`
                                : undefined;
                            return (
                                <div
                                    key={`slot-${slotNumber}-${spinRevealKey}`}
                                    className={[
                                        "wizard-slot",
                                        "wizard-slot--enter",
                                        slot?.pinned ? "pinned" : "",
                                        isWorking && !recipe ? "wizard-slot--scanning" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    style={
                                        {
                                            "--slot-n": slotNumber - 1,
                                            ...(cardBg ? { background: cardBg } : {}),
                                        } as React.CSSProperties
                                    }
                                >
                                    <div className="wizard-slot-num">{slotNumber}</div>
                                    <div className="wizard-slot-body">
                                        {recipe ? (
                                            <div
                                                key={recipe.id}
                                                className="wizard-slot-name wizard-slot-name--link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPeekRecipe(recipe);
                                                }}
                                            >
                                                {recipe.name}
                                                {recipe.source && (
                                                    <span className="wizard-slot-source">
                                                        {recipe.source}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="wizard-slot-empty">
                                                Empty
                                                <span className="wizard-slot-empty-hint">
                                                    {" "}
                                                    — pick or roll
                                                </span>
                                            </div>
                                        )}
                                        <div className="wizard-slot-filters">
                                            {filters.tagIds.map((tagId) => {
                                                const tag = allTags.find((t) => t.id === tagId);
                                                return tag ? (
                                                    <TagChip key={tagId} tag={tag} />
                                                ) : null;
                                            })}
                                            {filters.maxCookingTimeMinutes != null && (
                                                <span className="wizard-slot-time-chip">
                                                    ≤{filters.maxCookingTimeMinutes}min
                                                </span>
                                            )}
                                            {!recipe && (
                                                <SlotPoolCount
                                                    householdId={activeHouseholdId}
                                                    tagIds={filters.tagIds}
                                                    maxCookingTimeMinutes={
                                                        filters.maxCookingTimeMinutes
                                                    }
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="wizard-slot-actions">
                                        {slot?.pickedRecipeId && (
                                            <IonButton
                                                fill="clear"
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleClearSlot(slotNumber);
                                                }}
                                                disabled={isWorking}
                                            >
                                                <IonIcon
                                                    slot="icon-only"
                                                    icon={closeOutline}
                                                    color="medium"
                                                />
                                            </IonButton>
                                        )}
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFilterPopoverSlot(slotNumber);
                                            }}
                                            disabled={isWorking}
                                        >
                                            <IonIcon
                                                slot="icon-only"
                                                icon={filterOutline}
                                                color="medium"
                                            />
                                        </IonButton>
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPickerSlot(slotNumber);
                                            }}
                                            disabled={isWorking}
                                        >
                                            <IonIcon
                                                slot="icon-only"
                                                icon={searchOutline}
                                                color="medium"
                                            />
                                        </IonButton>
                                        {slot?.pickedRecipeId && (
                                            <IonButton
                                                fill="clear"
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTogglePin(
                                                        slotNumber,
                                                        slot?.pinned ?? false
                                                    );
                                                }}
                                                disabled={isWorking}
                                            >
                                                <IonIcon
                                                    slot="icon-only"
                                                    src={
                                                        slot?.pinned
                                                            ? "/img/pin-filled.svg"
                                                            : "/img/pin.svg"
                                                    }
                                                    color={slot?.pinned ? "primary" : "medium"}
                                                />
                                            </IonButton>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {canReview && (
                            <div className="wizard-robot-line">
                                {allSlotsFilled
                                    ? `> ${mealCount} ${pluralize("meal", mealCount)} locked. Proceed, or keep second-guessing yourself.`
                                    : pinnedCount > 0
                                      ? `> ${pinnedCount} locked in. Roll the rest or review as-is. I don't judge. Much.`
                                      : "> Partially filled. Commit to what you've got or roll the rest."}
                            </div>
                        )}
                    </>
                )}

                {/* ── Step 3: Route ─────────────────────────────────────────── */}
                {step === 3 && (
                    <>
                        <div className="wizard-scale-table">
                            <div className="wizard-section-title">Scale recipes</div>
                            {pickedRecipes.map((r) => (
                                <ScaleFactorControl
                                    key={r.id}
                                    label={r.name}
                                    factor={scaleFactors.get(r.id) ?? 1}
                                    onChange={(f) => setFactor(r.id, f)}
                                />
                            ))}
                        </div>
                        <RouteIngredientsContent
                            resolvedIngredients={routeIngredients}
                            routeMap={routeMap}
                            setRouteMap={setRouteMap}
                            defaultStoreId={defaultStoreId}
                            setDefaultStoreId={routing.setDefaultStoreId}
                            unsureSet={routing.unsureSet}
                            onToggleUnsure={routing.toggleUnsure}
                            visibleStores={visibleStores}
                            recipeCount={pickedRecipes.length}
                            unitMap={unitMap}
                            showPantryItems={showPantryItems}
                            onToggleShowPantryItems={handleToggleShowPantryItems}
                        />
                    </>
                )}

                {/* ── Step 4: Send ─────────────────────────────────────────── */}
                {step === 4 && (
                    <>
                        <div className="wizard-confirm-card">
                            <div className="wizard-confirm-title">Sending to shopping lists</div>
                            <div className="wizard-confirm-stat">
                                <span>Recipes</span>
                                <b>{pickedRecipes.length}</b>
                            </div>
                            <div className="wizard-confirm-stat">
                                <span>Ingredients</span>
                                <b>
                                    {includedCount} included
                                    {routeIngredients.length - includedCount > 0
                                        ? ` · ${routeIngredients.length - includedCount} skipped`
                                        : ""}
                                </b>
                            </div>
                            {[...storeBreakdown.entries()].map(([sId, count]) => (
                                <div key={sId} className="wizard-confirm-stat">
                                    <span>
                                        → {visibleStores.find((s) => s.id === sId)?.name ?? "Store"}
                                    </span>
                                    <b>{count}</b>
                                </div>
                            ))}
                        </div>

                        <div className="wizard-robot-line">
                            &gt; Plan compiled. Dispatching ingredients to designated stores.
                            Cooking is your problem now, human.
                        </div>

                        <div className="wizard-confirm-recipes">
                            <div className="wizard-section-title">What you'll cook</div>
                            {pickedRecipes.map((recipe, i) => (
                                <div key={recipe.id} className="wizard-confirm-recipe-row">
                                    <span className="wizard-confirm-num">{i + 1}</span>
                                    <span>
                                        {recipe.name}
                                        {recipe.source && (
                                            <span className="wizard-confirm-source">
                                                {recipe.source}
                                            </span>
                                        )}
                                    </span>
                                    {(scaleFactors.get(recipe.id) ?? 1) !== 1 && (
                                        <span className="wizard-confirm-scale">
                                            ×{scaleFactors.get(recipe.id)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </IonContent>

            <IonFooter>
                <IonToolbar>
                    {step === 1 && (
                        <IonButtons slot="end">
                            <IonButton onClick={handleNext} disabled={isWorking}>
                                {isWorking ? <IonSpinner name="dots" /> : "Next →"}
                            </IonButton>
                        </IonButtons>
                    )}

                    {step === 2 && (
                        <>
                            <IonButtons slot="start">
                                <IonButton onClick={handleBackToStep1} disabled={isWorking}>
                                    ← Back
                                </IonButton>
                            </IonButtons>
                            <IonButtons slot="end">
                                <IonButton
                                    onClick={() => {
                                        if (allSlotsFilled) {
                                            handleGoToRoute();
                                        } else {
                                            setShowPartialAlert(true);
                                        }
                                    }}
                                    disabled={isWorking || !canReview}
                                >
                                    {isWorking ? (
                                        <IonSpinner name="dots" />
                                    ) : (
                                        "Review ingredients →"
                                    )}
                                </IonButton>
                            </IonButtons>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <IonButtons slot="start">
                                <IonButton onClick={() => setStep(2)} disabled={isWorking}>
                                    ← Back
                                </IonButton>
                            </IonButtons>
                            <IonButtons slot="end">
                                <IonButton
                                    onClick={handleGoToSend}
                                    disabled={isWorking || includedCount === 0}
                                >
                                    {isWorking ? (
                                        <IonSpinner name="dots" />
                                    ) : (
                                        `Send ${includedCount} to ${pluralize("list", includedCount)} →`
                                    )}
                                </IonButton>
                            </IonButtons>
                        </>
                    )}

                    {step === 4 && (
                        <>
                            <IonButtons slot="start">
                                <IonButton onClick={() => setStep(3)} disabled={isWorking}>
                                    ← Back to review
                                </IonButton>
                            </IonButtons>
                            <IonButtons slot="end">
                                <IonButton onClick={handleDispatch} disabled={isWorking}>
                                    {isWorking ? <IonSpinner name="dots" /> : "Confirm & send"}
                                </IonButton>
                            </IonButtons>
                        </>
                    )}
                </IonToolbar>
            </IonFooter>
            <RecipePickerModal
                isOpen={pickerSlot !== null}
                onDismiss={() => setPickerSlot(null)}
                recipes={pickerRecipes}
                onPick={handlePickRecipe}
                filterTags={pickerFilterTags}
                maxCookingTimeMinutes={pickerSlotFilters?.maxCookingTimeMinutes}
                title={pickerSlot !== null ? `Slot ${pickerSlot} — Pick a recipe` : "Pick a recipe"}
            />

            <IonModal
                isOpen={peekRecipe !== null}
                onDidDismiss={() => setPeekRecipe(null)}
                breakpoints={[0, 0.85]}
                initialBreakpoint={0.85}
                handle={true}
            >
                {peekRecipe && (
                    <>
                        <IonHeader>
                            <IonToolbar>
                                <IonButtons slot="end">
                                    <IonButton onClick={() => setPeekRecipe(null)}>
                                        <IonIcon slot="icon-only" icon={closeOutline} />
                                    </IonButton>
                                </IonButtons>
                            </IonToolbar>
                        </IonHeader>
                        <IonContent>
                            <RecipeDetailContent recipe={peekRecipe} unitMap={unitMap} />
                        </IonContent>
                    </>
                )}
            </IonModal>

            <IonAlert
                isOpen={showPartialAlert}
                onDidDismiss={() => setShowPartialAlert(false)}
                header="Not all slots filled"
                message={`${mealCount - filledCount} ${pluralize("slot", mealCount - filledCount)} still empty. Continue anyway?`}
                buttons={[
                    { text: "Go back", role: "cancel" },
                    { text: "Continue anyway", role: "confirm", handler: handleGoToRoute },
                ]}
            />

            <IonModal
                isOpen={filterPopoverSlot !== null}
                onDidDismiss={() => setFilterPopoverSlot(null)}
                breakpoints={[0, 0.85]}
                initialBreakpoint={0.85}
                handle={true}
            >
                {filterPopoverSlot !== null && (
                    <SlotFilterSheet
                        slotNumber={filterPopoverSlot}
                        filters={
                            effectiveSlotFilters.get(filterPopoverSlot) ?? {
                                tagIds: [],
                                maxCookingTimeMinutes: null,
                            }
                        }
                        allTags={allTags}
                        hasRecipe={
                            !!planData?.slots.find((s) => s.slotNumber === filterPopoverSlot)
                                ?.pickedRecipeId
                        }
                        isWorking={isWorking}
                        onToggleTag={(tagId) => toggleSlotTag(filterPopoverSlot, tagId)}
                        onUpdateMaxTime={(val) => updateSlotMaxTime(filterPopoverSlot, val)}
                        onReroll={() => handleRerollSlotWithFilter(filterPopoverSlot)}
                        onDismiss={() => setFilterPopoverSlot(null)}
                    />
                )}
            </IonModal>
        </IonModal>
    );
};

export default MealPlanWizard;
