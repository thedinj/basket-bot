import type { RecipeWithDetails } from "@basket-bot/core";
import { IonAlert, IonButton, IonContent, IonIcon, IonModal, IonSpinner } from "@ionic/react";
import {
    addOutline,
    closeOutline,
    filterOutline,
    refreshOutline,
    removeOutline,
    searchOutline,
} from "ionicons/icons";
import clsx from "clsx";
import pluralize from "pluralize";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import RecipeFilterSheet from "../components/meals/RecipeFilterSheet";
import RecipePickerModal from "../components/meals/RecipePickerModal";
import RecipeViewSheet from "../components/meals/RecipeViewSheet";
import RouteIngredientsContent from "../components/meals/RouteIngredientsContent";
import ScaleFactorControl from "../components/meals/ScaleFactorControl";
import TagChip from "../components/meals/TagChip";
import { EditorFooter } from "../components/shared/EditorFooter";
import { ModalHeader } from "../components/shared/ModalHeader";
import { RobotLine } from "../components/shared/RobotLine";
import { useQuantityUnits, useVisibleStores } from "../db/hooks";
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
import { useRouteIngredients } from "../hooks/useRouteIngredients";
import { useToast } from "../hooks/useToast";
import {
    DEFAULT_STORE,
    countRoutedIngredients,
    resolveIngredient,
    type ResolvedIngredient,
} from "../utils/ingredientRouting";
import {
    DEFAULT_FILTERS,
    recipeFiltersToSlotFilters,
    slotFiltersToRecipeFilters,
    type RecipeFilters,
} from "../utils/recipeSearch";
import { useHousehold } from "../households/useHousehold";

import "./MealPlanWizard.scss";

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Pool", "Spin", "Route", "Send"] as const;

const ROBOT_QUIPS: Record<number, string> = {
    1: "One meal. Minimal commitment. Noted.",
    2: "Two. Technically a plan.",
    3: "Three. I've seen worse.",
    4: "Four. The minimum viable week.",
    5: "Five. Bold.",
    6: "Six. You enjoy cooking, apparently.",
    7: "Seven. Do you even own a couch?",
    8: "Eight. You are either organized or optimistic.",
    9: "Nine. The whole week. Respect.",
    10: "Ten meals. You clearly love this more than I do.",
    11: "Eleven. Unstoppable. Slightly alarming.",
    12: "Twelve meals. A culinary marathon. Godspeed.",
};

/**
 * Sign-off after a plan is dispatched. Rotated by the clock the same way
 * `ROBOT_LOADING_MESSAGES` is, so the line stays fresh without being random enough to
 * flicker between renders.
 */
const PLAN_SENT_QUIPS = [
    "The rest is your department.",
    "I have done my part.",
    "Cooking them is on you.",
    "Do not blame me for the results.",
    "Consider it handled.",
    "The lists are ready. You are, allegedly.",
] as const;

const pickQuip = (quips: readonly string[]) => quips[new Date().getMinutes() % quips.length];

// ── Slot pool count (sub-component to avoid hooks-in-loop) ──────────────────

const SlotPoolCount: React.FC<{
    householdId: string | null;
    tagIds: string[];
    maxCookingTimeMinutes: number | null;
}> = ({ householdId, tagIds, maxCookingTimeMinutes }) => {
    const { data: count } = usePoolCount(householdId, tagIds, maxCookingTimeMinutes);
    if (count === undefined) return null;
    return (
        <span className={clsx("info-pill", count === 0 && "info-pill--warn")}>{count} in pool</span>
    );
};

// ── Step indicator ──────────────────────────────────────────────────────────

/** Four equal segments across the gutter, each labelled with its step's number and name. */
const StepBar: React.FC<{ step: WizardStep }> = ({ step }) => (
    <ol className="wizard-steps" aria-label="Plan steps">
        {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            return (
                <li
                    key={label}
                    className={clsx(
                        "wizard-steps__step",
                        n < step && "wizard-steps__step--done",
                        n === step && "wizard-steps__step--active"
                    )}
                    aria-current={n === step ? "step" : undefined}
                >
                    <span className="wizard-steps__num">{n}</span>
                    {label}
                </li>
            );
        })}
    </ol>
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
    const { data: units } = useQuantityUnits();
    const { showError, showSuccess } = useToast();

    const visibleStores = useVisibleStores();
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
    // Times each slot has been rolled. It keys the slot's card, so a roll remounts (and
    // replays the entrance of) only the slots it rolled; pinned cards stay still.
    const [slotRolls, setSlotRolls] = useState<Map<number, number>>(new Map());
    const [slotFilters, setSlotFilters] = useState<
        Map<number, { tagIds: string[]; maxCookingTimeMinutes: number | null }>
    >(new Map());

    // Step 2: manual recipe picker, and the slot's own shortcut straight to its filters
    const [pickerSlot, setPickerSlot] = useState<number | null>(null);
    const [filterPopoverSlot, setFilterPopoverSlot] = useState<number | null>(null);
    const [showPartialAlert, setShowPartialAlert] = useState(false);

    // Step 2: recipe peek sheet
    const [peekRecipe, setPeekRecipe] = useState<RecipeWithDetails | null>(null);

    // Step 3: ingredientId → storeId | null (null = skip on dispatch)
    const routing = useRouteIngredients();
    const routeMap = routing.routeMap;
    const setRouteMap = routing.setRouteMap;
    const defaultStoreId = routing.defaultStoreId;
    const [showSkippedItems, setShowSkippedItems] = useState(false);

    const handleToggleShowSkippedItems = () => {
        setShowSkippedItems((prev) => {
            const next = !prev;
            if (!next) {
                // Hiding skipped items again — uncheck any that were checked so a
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
        setSlotRolls(new Map());
        setSlotFilters(new Map());
        setPickerSlot(null);
        setFilterPopoverSlot(null);
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

    // A slot's filters reach the shared sheet in the shared shape, whether the sheet was
    // opened from the slot's own filter button or from inside the recipe picker. Both
    // entry points read and write through these two helpers.
    const filtersForSlot = (slotNumber: number | null): RecipeFilters =>
        slotFiltersToRecipeFilters(
            (slotNumber !== null ? effectiveSlotFilters.get(slotNumber) : null) ?? {
                tagIds: [],
                maxCookingTimeMinutes: null,
            }
        );

    const setFiltersForSlot = (slotNumber: number | null, next: RecipeFilters) => {
        if (slotNumber === null) return;
        setSlotFilters((prev) => {
            const map = new Map(prev);
            map.set(slotNumber, recipeFiltersToSlotFilters(next));
            return map;
        });
    };

    // The slot filter sheet only opens on an empty slot (Filter is disabled once a recipe is
    // in), so its action always fills.
    const slotPrimaryAction = (slotNumber: number | null) => ({
        label: "Fill this slot",
        onClick: () => slotNumber !== null && handleRerollSlotWithFilter(slotNumber),
        isWorking,
    });

    const routeIngredients = useMemo(() => {
        if (!planData) return [];
        const context = { routeMap, defaultStoreId, unsureSet: routing.unsureSet };
        const result: ResolvedIngredient[] = [];
        for (const slot of planData.slots) {
            if (!slot.pickedRecipeId) continue;
            const recipe = recipeById.get(slot.pickedRecipeId);
            if (!recipe) continue;
            // Scaling is per recipe, so each slot's ingredients resolve with their own factor.
            const factor = scaleFactors.get(recipe.id) ?? 1;
            for (const ing of recipe.ingredients) {
                result.push(
                    resolveIngredient(
                        {
                            id: ing.id,
                            recipeId: recipe.id,
                            name: ing.name,
                            recipeName: recipe.name,
                            qty: ing.qty,
                            unitId: ing.unitId ?? null,
                            excluded: ing.excluded,
                            isUnsure: routing.unsureSet.has(ing.id),
                        },
                        context,
                        factor
                    )
                );
            }
        }
        return result;
    }, [planData, recipeById, routeMap, defaultStoreId, scaleFactors, routing.unsureSet]);

    const includedCount = countRoutedIngredients(routeIngredients);

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
            setSlotRolls((prev) => {
                const next = new Map(prev);
                for (const n of toRoll) next.set(n, (next.get(n) ?? 0) + 1);
                return next;
            });
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
                // Rerolling a slot unpins it — every reroll path skips pinned slots, so
                // leaving the pin on would silently turn this into a no-op.
                pinned: s.slotNumber === slotNumber ? false : s.pinned,
            }));
            await updateSlotsMut.mutateAsync({ planId, slots: updatedSlots });
            await rerollMut.mutateAsync({ planId, slots: [slotNumber] });
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
                // Existing explicit routes keep their store; new shoppable items default to
                // the sentinel, new skipped items default to unchecked.
                newMap.set(ing.id, existing?.storeId ?? (ing.excluded ? null : DEFAULT_STORE));
                if (existing ? existing.isUnsure : ing.isUnsure) newUnsureSet.add(ing.id);
            }
        }

        setShowSkippedItems(false);
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
        // Read the tallies before dispatching — the plan is cleared from cache on success,
        // which takes `routeIngredients` and everything derived from it with it.
        const mealsSent = pickedRecipes.length;
        const itemsSent = includedCount;
        const listsSent = storeBreakdown.size;
        setIsWorking(true);
        try {
            await dispatchMut.mutateAsync({
                planId,
                scaleFactors: Object.fromEntries(scaleFactors),
            });
            showSuccess(
                `${mealsSent} ${pluralize("meal", mealsSent)}, ` +
                    `${itemsSent} ${pluralize("item", itemsSent)}, ` +
                    `${listsSent} ${pluralize("list", listsSent)}. ${pickQuip(PLAN_SENT_QUIPS)}`
            );
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
            <ModalHeader title="Plan meals" onClose={handleClose} closeDisabled={isWorking}>
                <StepBar step={step} />
            </ModalHeader>

            <IonContent className="wizard-content">
                {/* ── Step 1: Pool ─────────────────────────────────────────── */}
                {step === 1 && (
                    <section className="wizard-section">
                        <h2 className="ruled-label">How many meals?</h2>
                        <div className="wizard-counter">
                            <button
                                type="button"
                                className="wizard-counter__btn"
                                onClick={() => setMealCount((n) => Math.max(1, n - 1))}
                                disabled={mealCount <= 1}
                                aria-label="One fewer meal"
                            >
                                <IonIcon icon={removeOutline} />
                            </button>
                            <output className="wizard-counter__value" aria-live="polite">
                                <span className="wizard-counter__num">{mealCount}</span>
                                <span className="wizard-counter__unit">
                                    {pluralize("meal", mealCount)}
                                </span>
                            </output>
                            <button
                                type="button"
                                className="wizard-counter__btn"
                                onClick={() => setMealCount((n) => Math.min(12, n + 1))}
                                disabled={mealCount >= 12}
                                aria-label="One more meal"
                            >
                                <IonIcon icon={addOutline} />
                            </button>
                        </div>
                        <RobotLine className="wizard-robot-line">
                            {ROBOT_QUIPS[mealCount]}
                        </RobotLine>
                    </section>
                )}

                {/* ── Step 2: Spin ─────────────────────────────────────────── */}
                {step === 2 && (
                    <>
                        <div className="wizard-toolbar">
                            <span className="wizard-toolbar__meta">
                                {filledCount} of {mealCount} filled
                                {pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ""}
                            </span>
                            <button
                                type="button"
                                className="form-field__action form-field__action--standalone"
                                onClick={handleRoll}
                                disabled={isWorking || !planId || allSlotsPinned}
                            >
                                <IonIcon icon={refreshOutline} />
                                {filledCount === 0 ? "Roll" : "Roll unpinned"}
                            </button>
                        </div>

                        <div className="wizard-slots">
                            {Array.from({ length: mealCount }, (_, i) => i + 1).map(
                                (slotNumber) => {
                                    const slot = planData?.slots.find(
                                        (s) => s.slotNumber === slotNumber
                                    );
                                    const recipe = slot?.pickedRecipeId
                                        ? recipeById.get(slot.pickedRecipeId)
                                        : undefined;
                                    const filters = effectiveSlotFilters.get(slotNumber) ?? {
                                        tagIds: [],
                                        maxCookingTimeMinutes: null,
                                    };
                                    const pinned = slot?.pinned ?? false;
                                    const firstTagKey = recipe?.tags[0]?.colorKey ?? null;
                                    const cardBg = firstTagKey
                                        ? `linear-gradient(150deg, var(--tag-${firstTagKey}-bg) 0%, var(--wizard-card-bg) 60%)`
                                        : undefined;
                                    return (
                                        <article
                                            key={`slot-${slotNumber}-${slotRolls.get(slotNumber) ?? 0}`}
                                            className={clsx(
                                                "surface-card",
                                                "wizard-slot",
                                                "wizard-slot--enter",
                                                pinned && "wizard-slot--pinned",
                                                isWorking && !recipe && "wizard-slot--scanning"
                                            )}
                                            style={
                                                {
                                                    "--slot-n": slotNumber - 1,
                                                    ...(cardBg ? { background: cardBg } : {}),
                                                } as React.CSSProperties
                                            }
                                            aria-label={`Slot ${slotNumber}`}
                                        >
                                            <div className="wizard-slot__body">
                                                <span
                                                    className="wizard-slot__num"
                                                    aria-hidden="true"
                                                >
                                                    {slotNumber}
                                                </span>
                                                {recipe ? (
                                                    <button
                                                        key={recipe.id}
                                                        type="button"
                                                        className="wizard-slot__recipe"
                                                        onClick={() => setPeekRecipe(recipe)}
                                                    >
                                                        <span className="wizard-slot__name">
                                                            {recipe.name}
                                                        </span>
                                                        {recipe.source && (
                                                            <span className="wizard-slot__source">
                                                                {recipe.source}
                                                            </span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div className="wizard-slot__recipe wizard-slot__recipe--empty">
                                                        <span className="wizard-slot__name">
                                                            Empty
                                                        </span>
                                                        <span className="wizard-slot__source">
                                                            Pick a recipe or roll
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="wizard-slot__filters">
                                                    {filters.tagIds.map((tagId) => {
                                                        const tag = allTags.find(
                                                            (t) => t.id === tagId
                                                        );
                                                        return tag ? (
                                                            <TagChip key={tagId} tag={tag} />
                                                        ) : null;
                                                    })}
                                                    {filters.maxCookingTimeMinutes != null && (
                                                        <span className="info-pill">
                                                            ≤ {filters.maxCookingTimeMinutes} min
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

                                            {/* Always four columns, so the bars line up card
                                                to card. Pin and Clear wait for a recipe;
                                                Filter waits for the slot to be empty. */}
                                            <div className="card-actions">
                                                <button
                                                    type="button"
                                                    className="card-actions__btn"
                                                    onClick={() => setPickerSlot(slotNumber)}
                                                    disabled={isWorking}
                                                    aria-label={`Browse recipes for slot ${slotNumber}`}
                                                >
                                                    <IonIcon icon={searchOutline} />
                                                    Pick
                                                </button>
                                                <button
                                                    type="button"
                                                    className="card-actions__btn"
                                                    onClick={() => setFilterPopoverSlot(slotNumber)}
                                                    // Filters steer the next roll into an
                                                    // empty slot; once a recipe is in, Clear
                                                    // it first.
                                                    disabled={isWorking || !!recipe}
                                                    aria-label={`Filter slot ${slotNumber}`}
                                                >
                                                    <IonIcon icon={filterOutline} />
                                                    Filter
                                                </button>
                                                <button
                                                    type="button"
                                                    className={clsx(
                                                        "card-actions__btn",
                                                        pinned && "card-actions__btn--on"
                                                    )}
                                                    onClick={() =>
                                                        handleTogglePin(slotNumber, pinned)
                                                    }
                                                    disabled={isWorking || !recipe}
                                                    aria-pressed={pinned}
                                                    aria-label={`Pin slot ${slotNumber}`}
                                                >
                                                    <IonIcon
                                                        src={
                                                            pinned
                                                                ? "/img/pin-filled.svg"
                                                                : "/img/pin.svg"
                                                        }
                                                    />
                                                    {pinned ? "Pinned" : "Pin"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="card-actions__btn"
                                                    onClick={() => handleClearSlot(slotNumber)}
                                                    disabled={isWorking || !recipe}
                                                    aria-label={`Clear slot ${slotNumber}`}
                                                >
                                                    <IonIcon icon={closeOutline} />
                                                    Clear
                                                </button>
                                            </div>
                                        </article>
                                    );
                                }
                            )}
                        </div>

                        {canReview && (
                            <RobotLine className="wizard-robot-line">
                                {allSlotsFilled
                                    ? `${mealCount} ${pluralize("meal", mealCount)} locked. Proceed, or keep second-guessing yourself.`
                                    : pinnedCount > 0
                                      ? `${pinnedCount} locked in. Roll the rest or review as-is. I don't judge. Much.`
                                      : "Partially filled. Commit to what you've got or roll the rest."}
                            </RobotLine>
                        )}
                    </>
                )}

                {/* ── Step 3: Route ─────────────────────────────────────────── */}
                {step === 3 && (
                    <>
                        <section className="wizard-section">
                            <h2 className="ruled-label">Scale recipes</h2>
                            <div className="wizard-scale-list">
                                {pickedRecipes.map((r) => (
                                    <ScaleFactorControl
                                        key={r.id}
                                        label={r.name}
                                        factor={scaleFactors.get(r.id) ?? 1}
                                        onChange={(f) => setFactor(r.id, f)}
                                    />
                                ))}
                            </div>
                        </section>
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
                            showSkippedItems={showSkippedItems}
                            onToggleShowSkippedItems={handleToggleShowSkippedItems}
                        />
                    </>
                )}

                {/* ── Step 4: Send ─────────────────────────────────────────── */}
                {step === 4 && (
                    <>
                        <section className="wizard-section">
                            <h2 className="ruled-label">Sending</h2>
                            <dl className="tally">
                                <dt>Recipes</dt>
                                <dd>{pickedRecipes.length}</dd>
                                <dt>Ingredients</dt>
                                <dd>{includedCount}</dd>
                                {routeIngredients.length - includedCount > 0 && (
                                    <>
                                        <dt className="tally__quiet">Skipped</dt>
                                        <dd className="tally__quiet">
                                            {routeIngredients.length - includedCount}
                                        </dd>
                                    </>
                                )}
                            </dl>
                        </section>

                        <section className="wizard-section">
                            <h2 className="ruled-label">
                                {pluralize("List", storeBreakdown.size)}
                            </h2>
                            <dl className="tally">
                                {[...storeBreakdown.entries()].map(([sId, count]) => (
                                    <React.Fragment key={sId}>
                                        <dt>
                                            {visibleStores.find((s) => s.id === sId)?.name ??
                                                "Store"}
                                        </dt>
                                        <dd>
                                            {count} {pluralize("item", count)}
                                        </dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                        </section>

                        <RobotLine className="wizard-robot-line">
                            Plan compiled. Dispatching ingredients to designated stores. Cooking is
                            your problem now, human.
                        </RobotLine>

                        <section className="wizard-section">
                            <h2 className="ruled-label">What you&apos;ll cook</h2>
                            <ol className="wizard-cook-list">
                                {pickedRecipes.map((recipe, i) => (
                                    <li key={recipe.id} className="wizard-cook-list__row">
                                        <span className="wizard-cook-list__num" aria-hidden="true">
                                            {i + 1}
                                        </span>
                                        <span className="wizard-cook-list__text">
                                            <span className="wizard-cook-list__name">
                                                {recipe.name}
                                            </span>
                                            {recipe.source && (
                                                <span className="wizard-cook-list__source">
                                                    {recipe.source}
                                                </span>
                                            )}
                                        </span>
                                        {(scaleFactors.get(recipe.id) ?? 1) !== 1 && (
                                            <span className="qty">
                                                ×{scaleFactors.get(recipe.id)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    </>
                )}
            </IonContent>

            <EditorFooter
                onBack={
                    step === 1
                        ? undefined
                        : step === 2
                          ? handleBackToStep1
                          : () => setStep((step - 1) as WizardStep)
                }
                backLabel={step === 4 ? "Back to review" : "Back"}
                backDisabled={isWorking}
            >
                <IonButton
                    expand="block"
                    className="editor-form__submit"
                    onClick={
                        step === 1
                            ? handleNext
                            : step === 2
                              ? () =>
                                    allSlotsFilled ? handleGoToRoute() : setShowPartialAlert(true)
                              : step === 3
                                ? handleGoToSend
                                : handleDispatch
                    }
                    disabled={
                        isWorking ||
                        (step === 2 && !canReview) ||
                        (step === 3 && includedCount === 0)
                    }
                >
                    {isWorking ? (
                        <IonSpinner name="dots" />
                    ) : step === 1 ? (
                        "Next"
                    ) : step === 2 ? (
                        "Review ingredients"
                    ) : step === 3 ? (
                        `Send ${includedCount} to ${pluralize("list", includedCount)}`
                    ) : (
                        "Confirm & send"
                    )}
                </IonButton>
            </EditorFooter>
            <RecipePickerModal
                isOpen={pickerSlot !== null}
                onDismiss={() => setPickerSlot(null)}
                recipes={recipes}
                allTags={allTags}
                onPick={handlePickRecipe}
                initialFilters={filtersForSlot(pickerSlot)}
                slotNumber={pickerSlot}
                title={pickerSlot !== null ? `Slot ${pickerSlot} — Pick a recipe` : "Pick a recipe"}
            />

            {/* The slot's filter shortcut opens the same sheet the picker uses, minus the
                sort section — there is no recipe list behind it to reorder. */}
            <RecipeFilterSheet
                isOpen={filterPopoverSlot !== null}
                filters={filtersForSlot(filterPopoverSlot)}
                allTags={allTags}
                hasPoolExcludedRecipes={false}
                onFiltersChange={(next) => setFiltersForSlot(filterPopoverSlot, next)}
                onReset={() => setFiltersForSlot(filterPopoverSlot, DEFAULT_FILTERS)}
                onDismiss={() => setFilterPopoverSlot(null)}
                sections={["time", "tags"]}
                heading={filterPopoverSlot !== null ? `Slot ${filterPopoverSlot}` : undefined}
                primaryAction={slotPrimaryAction(filterPopoverSlot)}
            />

            <RecipeViewSheet
                recipe={peekRecipe}
                unitMap={unitMap}
                onDismiss={() => setPeekRecipe(null)}
            />

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
        </IonModal>
    );
};

export default MealPlanWizard;
