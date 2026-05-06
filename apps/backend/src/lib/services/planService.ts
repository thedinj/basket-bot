import type { Plan, PlanWithDetails } from "@basket-bot/core"
import { db } from "../db/db"
import * as householdRepo from "../repos/householdRepo"
import * as itemRepo from "../repos/itemRepo"
import * as planRepo from "../repos/planRepo"
import * as recipeRepo from "../repos/recipeRepo"
import * as shoppingListRepo from "../repos/shoppingListRepo"
import { roundFactor } from "../utils/math"

/**
 * Verify user is a member of the household (throws "Access denied" if not).
 */
function assertMember(householdId: string, userId: string): void {
    if (!householdRepo.userIsMember(householdId, userId)) {
        throw new Error("Access denied")
    }
}

function assertPlanBelongs(plan: Plan | null, householdId: string): asserts plan is Plan {
    if (!plan || plan.householdId !== householdId) throw new Error("Plan not found")
}

// ========== Plan CRUD ==========

export function createPlan(params: {
    householdId: string
    slotCount?: number
    userId: string
}): PlanWithDetails {
    assertMember(params.householdId, params.userId)

    const plan = planRepo.createPlan({
        householdId: params.householdId,
        slotCount: params.slotCount ?? 4,
        createdById: params.userId,
    })

    return planRepo.getPlanWithDetails(plan.id)!
}

export function getPlansByHousehold(householdId: string, userId: string): Plan[] {
    assertMember(householdId, userId)
    return planRepo.getPlansByHousehold(householdId)
}

export function getPlanWithDetails(
    householdId: string,
    planId: string,
    userId: string
): PlanWithDetails | null {
    assertMember(householdId, userId)

    const plan = planRepo.getPlanWithDetails(planId)
    if (!plan || plan.householdId !== householdId) return null
    return plan
}

export function updatePlan(
    householdId: string,
    planId: string,
    userId: string,
    updates: { slotCount?: number; defaultStoreId?: string | null }
): PlanWithDetails | null {
    assertMember(householdId, userId)

    const existing = planRepo.getPlanById(planId)
    assertPlanBelongs(existing, householdId)
    if (existing.state !== "draft") throw new Error("Only draft plans can be edited")

    planRepo.updatePlan({ id: planId, ...updates, updatedById: userId })

    // Sync slot rows when slotCount changes
    if (updates.slotCount !== undefined) {
        if (updates.slotCount < existing.slotCount) {
            planRepo.deleteExtraSlots(planId, updates.slotCount)
        } else if (updates.slotCount > existing.slotCount) {
            const newSlots = []
            for (let i = existing.slotCount + 1; i <= updates.slotCount; i++) {
                newSlots.push({ slotNumber: i, tagIds: [] })
            }
            planRepo.upsertSlots(planId, newSlots)
        }
    }

    return planRepo.getPlanWithDetails(planId)!
}

export function deletePlan(householdId: string, planId: string, userId: string): boolean {
    assertMember(householdId, userId)

    const existing = planRepo.getPlanById(planId)
    if (!existing || existing.householdId !== householdId) return false
    if (existing.state === "active") throw new Error("Cannot delete an active plan")

    return planRepo.deletePlan(planId)
}

// ========== Slot configuration ==========

export function updateSlots(
    householdId: string,
    planId: string,
    userId: string,
    slots: Array<{
        slotNumber: number
        tagIds: string[]
        maxCookingTimeMinutes?: number | null
        pickedRecipeId?: string | null
        pinned?: boolean
    }>
): PlanWithDetails | null {
    assertMember(householdId, userId)

    const plan = planRepo.getPlanById(planId)
    assertPlanBelongs(plan, householdId)
    if (plan.state !== "draft") throw new Error("Only draft plans can be edited")

    planRepo.upsertSlots(planId, slots)
    planRepo.updatePlan({ id: planId, updatedById: userId })

    return planRepo.getPlanWithDetails(planId)!
}

// ========== Reroll ==========

/**
 * Pick a random recipe for each requested slot, respecting:
 * - The slot's tag intent (must match ALL tags)
 * - Pinned slots are skipped
 * - Recipes pinned in other slots are excluded from the pool for this reroll batch
 */
export function rerollSlots(
    householdId: string,
    planId: string,
    userId: string,
    slotNumbers: number[]
): PlanWithDetails | null {
    assertMember(householdId, userId)

    const plan = planRepo.getPlanWithDetails(planId)
    assertPlanBelongs(plan, householdId)
    if (plan.state !== "draft") throw new Error("Only draft plans can be rerolled")

    // Collect recipe IDs that are pinned in slots we're NOT rerolling, so we don't duplicate
    const reservedIds = new Set<string>()
    for (const slot of plan.slots) {
        if (slot.pinned && !slotNumbers.includes(slot.slotNumber) && slot.pickedRecipeId) {
            reservedIds.add(slot.pickedRecipeId)
        }
    }

    // Build pool for each slot upfront, then sort smallest-pool-first so the
    // most constrained slots pick before less-constrained ones shrink the pool.
    const slotsToFill = slotNumbers
        .map((n) => {
            const slot = plan.slots.find((s) => s.slotNumber === n)
            if (!slot || slot.pinned) return null
            const pool = recipeRepo.searchRecipes(
                householdId,
                slot.tagIds,
                slot.maxCookingTimeMinutes,
            )
            return { slot, pool }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.pool.length - b.pool.length)

    for (const { slot, pool } of slotsToFill) {
        const available = pool.filter((r) => !reservedIds.has(r.id))

        const pick =
            available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : null

        planRepo.setSlotPick(planId, slot.slotNumber, pick?.id ?? null)

        if (pick) reservedIds.add(pick.id)
    }

    planRepo.updatePlan({ id: planId, updatedById: userId })
    return planRepo.getPlanWithDetails(planId)!
}

// ========== Route assignment ==========

export function updateRoutes(
    householdId: string,
    planId: string,
    userId: string,
    routes: Array<{
        ingredientId: string
        storeId?: string | null
        overridden?: boolean
        checked?: boolean
    }>
): PlanWithDetails | null {
    assertMember(householdId, userId)

    const plan = planRepo.getPlanById(planId)
    assertPlanBelongs(plan, householdId)
    if (plan.state !== "draft") throw new Error("Only draft plans can be edited")

    planRepo.upsertRoutes(planId, routes)
    planRepo.updatePlan({ id: planId, updatedById: userId })

    return planRepo.getPlanWithDetails(planId)!
}

// ========== Dispatch ==========

/**
 * Dispatch a plan: flip state to active, add routed ingredients to shopping lists.
 * Each routed ingredient is upserted into the target store's shopping list.
 */
export function dispatchPlan(
    householdId: string,
    planId: string,
    userId: string,
    scaleFactors: Record<string, number> = {}
): { plan: Plan; itemsAdded: number; itemsSkipped: number } {
    assertMember(householdId, userId)

    const plan = planRepo.getPlanWithDetails(planId)
    assertPlanBelongs(plan, householdId)
    if (plan.state !== "draft") throw new Error("Only draft plans can be dispatched")

    let itemsAdded = 0
    let itemsSkipped = 0
    const now = new Date().toISOString()

    const dispatchAll = db.transaction(() => {
        for (const route of plan.routes) {
            if (!route.storeId) {
                itemsSkipped++
                continue
            }

            const ingredient = db
                .prepare(
                    `SELECT ri.name, ri.shoppingName, ri.qty, ri.shoppingQty, ri.unitId, ri.shoppingUnitId, ri.recipeId, r.name AS recipeName
                     FROM RecipeIngredient ri
                     JOIN Recipe r ON r.id = ri.recipeId
                     WHERE ri.id = ?`
                )
                .get(route.ingredientId) as { name: string; shoppingName: string | null; qty: number | null; shoppingQty: number | null; unitId: string | null; shoppingUnitId: string | null; recipeId: string; recipeName: string } | undefined

            if (!ingredient) {
                itemsSkipped++
                continue
            }

            const factor = scaleFactors[ingredient.recipeId] ?? 1
            const hasShoppingOverride = ingredient.shoppingQty !== null || ingredient.shoppingUnitId !== null
            const effectiveQty = hasShoppingOverride ? ingredient.shoppingQty : ingredient.qty
            const effectiveUnitId = hasShoppingOverride ? ingredient.shoppingUnitId : ingredient.unitId
            const scaledQty = effectiveQty != null ? roundFactor(effectiveQty * factor) : null

            // Find or create a StoreItem for this ingredient in the target store
            const storeItem = itemRepo.getOrCreateStoreItemByName({
                storeId: route.storeId,
                name: ingredient.shoppingName ?? ingredient.name,
                createdById: userId,
            })

            shoppingListRepo.upsertShoppingListItem({
                storeId: route.storeId,
                storeItemId: storeItem.id,
                qty: scaledQty,
                unitId: effectiveUnitId ?? null,
                notes: ingredient.recipeName,
                userId,
            })

            itemsAdded++
        }
    })

    dispatchAll()

    const updatedPlan = planRepo.updatePlan({
        id: planId,
        state: "active",
        dispatchedAt: now,
        updatedById: userId,
    })!

    return { plan: updatedPlan, itemsAdded, itemsSkipped }
}

// ========== Plan History ==========

export function getPlansHistory(
    householdId: string,
    userId: string,
    limit: number,
    offset: number
) {
    assertMember(householdId, userId)
    return planRepo.getPlansHistory(householdId, limit, offset)
}

// ========== Pool count ==========

export function getPoolCount(
    householdId: string,
    userId: string,
    tagIds: string[],
    maxCookingTimeMinutes?: number | null
): number {
    assertMember(householdId, userId)
    return recipeRepo.searchRecipes(householdId, tagIds, maxCookingTimeMinutes).length
}
