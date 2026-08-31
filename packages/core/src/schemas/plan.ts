import { z } from "zod";

// ========== Enums ==========
export const planStateSchema = z.enum(["draft", "active", "archived"]);
export type PlanState = z.infer<typeof planStateSchema>;

// ========== Plan ==========
export const planSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    state: planStateSchema,
    slotCount: z.number().int().min(1).max(12),
    defaultStoreId: z.string().uuid().nullable(),
    dispatchedAt: z.string().datetime().nullable(),
    createdById: z.string().uuid(),
    updatedById: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Plan = z.infer<typeof planSchema>;

// ========== PlanSlot ==========
export const planSlotSchema = z.object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    slotNumber: z.number().int().min(1),
    tagIds: z.array(z.string().uuid()),
    maxCookingTimeMinutes: z.number().int().min(1).nullable(),
    pickedRecipeId: z.string().uuid().nullable(),
    pinned: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type PlanSlot = z.infer<typeof planSlotSchema>;

// ========== PlanIngredientRoute ==========
export const planIngredientRouteSchema = z.object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    ingredientId: z.string().uuid(),
    storeId: z.string().uuid().nullable(),
    overridden: z.boolean(),
    checked: z.boolean(),
    isUnsure: z.boolean().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type PlanIngredientRoute = z.infer<typeof planIngredientRouteSchema>;

// ========== Joined / detail types ==========
export const planWithDetailsSchema = planSchema.extend({
    slots: z.array(planSlotSchema),
    routes: z.array(planIngredientRouteSchema),
});
export type PlanWithDetails = z.infer<typeof planWithDetailsSchema>;

// ========== Request schemas ==========

export const createPlanRequestSchema = z.object({
    slotCount: z.number().int().min(1).max(12).optional().default(4),
});
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;

export const updatePlanRequestSchema = z.object({
    slotCount: z.number().int().min(1).max(12).optional(),
    defaultStoreId: z.string().uuid().nullable().optional(),
});
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;

// PUT /plans/[id]/slots — replace all slot configuration for the plan
export const updatePlanSlotsRequestSchema = z.object({
    slots: z.array(
        z.object({
            slotNumber: z.number().int().min(1),
            tagIds: z.array(z.string().uuid()),
            maxCookingTimeMinutes: z.number().int().min(1).nullable().optional(),
            pickedRecipeId: z.string().uuid().nullable().optional(),
            pinned: z.boolean().optional(),
        })
    ),
});
export type UpdatePlanSlotsRequest = z.infer<typeof updatePlanSlotsRequestSchema>;

// POST /plans/[id]/reroll — pick new recipes for specific slots
export const rerollPlanRequestSchema = z.object({
    slots: z.array(z.number().int().min(1)),
});
export type RerollPlanRequest = z.infer<typeof rerollPlanRequestSchema>;

// PUT /plans/[id]/routes — replace route assignments
export const updateRoutesRequestSchema = z.object({
    routes: z.array(
        z.object({
            ingredientId: z.string().uuid(),
            storeId: z.string().uuid().nullable(),
            overridden: z.boolean().optional(),
            checked: z.boolean().optional(),
            isUnsure: z.boolean().nullable().optional(),
        })
    ),
});
export type UpdateRoutesRequest = z.infer<typeof updateRoutesRequestSchema>;

// ========== Plan history (list view, slots with recipe names, no routes) ==========

export const planHistorySlotSchema = z.object({
    slotNumber: z.number().int(),
    recipeName: z.string().nullable(),
});
export type PlanHistorySlot = z.infer<typeof planHistorySlotSchema>;

export const planHistoryItemSchema = planSchema.extend({
    slots: z.array(planHistorySlotSchema),
});
export type PlanHistoryItem = z.infer<typeof planHistoryItemSchema>;

export const planHistoryResponseSchema = z.object({
    plans: z.array(planHistoryItemSchema),
    total: z.number().int().min(0),
});
export type PlanHistoryResponse = z.infer<typeof planHistoryResponseSchema>;

// ========== Dispatch request ==========

export const dispatchPlanRequestSchema = z.object({
    // recipeId → scale factor; missing entries default to 1 on the backend
    scaleFactors: z.record(z.string().uuid(), z.number().min(0.01).max(100)).optional().default({}),
});
export type DispatchPlanRequest = z.infer<typeof dispatchPlanRequestSchema>;

// ========== Response schemas ==========

export const poolCountResponseSchema = z.object({
    count: z.number().int().min(0),
});
export type PoolCountResponse = z.infer<typeof poolCountResponseSchema>;

export const dispatchPlanResponseSchema = z.object({
    plan: planSchema,
    itemsAdded: z.number().int().min(0),
    itemsSkipped: z.number().int().min(0),
});
export type DispatchPlanResponse = z.infer<typeof dispatchPlanResponseSchema>;
