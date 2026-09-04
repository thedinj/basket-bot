import type { Plan, PlanIngredientRoute, PlanSlot, PlanWithDetails } from "@basket-bot/core";
import { db } from "../db/db";
import { boolToInt, intToBool } from "../utils/sqliteUtils";

type PlanSlotRow = Omit<PlanSlot, "tagIds" | "pinned"> & { tagIds: string; pinned: number | null };
type PlanIngredientRouteRow = Omit<PlanIngredientRoute, "overridden" | "checked" | "isUnsure"> & {
    overridden: number | null;
    checked: number | null;
    isUnsure: number | null;
};

// ========== Plan CRUD ==========

export function createPlan(params: {
    householdId: string;
    slotCount: number;
    createdById: string;
}): Plan {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Plan (id, householdId, state, slotCount, defaultStoreId, dispatchedAt, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, 'draft', ?, NULL, NULL, ?, ?, ?, ?)`
    ).run(
        id,
        params.householdId,
        params.slotCount,
        params.createdById,
        params.createdById,
        now,
        now
    );

    // Create default slots
    const insertSlot = db.prepare(
        `INSERT INTO PlanSlot (id, planId, slotNumber, tagIds, maxCookingTimeMinutes, pickedRecipeId, pinned, createdAt, updatedAt)
         VALUES (?, ?, ?, '[]', NULL, NULL, NULL, ?, ?)`
    );
    const insertSlots = db.transaction(() => {
        for (let i = 1; i <= params.slotCount; i++) {
            insertSlot.run(crypto.randomUUID(), id, i, now, now);
        }
    });
    insertSlots();

    return getPlanById(id)!;
}

export function getPlanById(id: string): Plan | null {
    const row = db
        .prepare(
            `SELECT id, householdId, state, slotCount, defaultStoreId, dispatchedAt,
                    createdById, updatedById, createdAt, updatedAt
             FROM Plan WHERE id = ?`
        )
        .get(id) as Plan | undefined;

    if (!row) return null;
    return mapPlan(row);
}

export function getPlansByHousehold(householdId: string): Plan[] {
    const rows = db
        .prepare(
            `SELECT id, householdId, state, slotCount, defaultStoreId, dispatchedAt,
                    createdById, updatedById, createdAt, updatedAt
             FROM Plan
             WHERE householdId = ?
             ORDER BY createdAt DESC`
        )
        .all(householdId) as Plan[];

    return rows.map(mapPlan);
}

export function getPlanWithDetails(id: string): PlanWithDetails | null {
    const plan = getPlanById(id);
    if (!plan) return null;

    const slots = getSlotsByPlan(id);
    const routes = getRoutesByPlan(id);

    return { ...plan, slots, routes };
}

export function updatePlan(params: {
    id: string;
    slotCount?: number;
    defaultStoreId?: string | null;
    state?: "draft" | "active" | "archived";
    dispatchedAt?: string | null;
    updatedById: string;
}): Plan | null {
    const existing = getPlanById(params.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    db.prepare(
        `UPDATE Plan
         SET slotCount = ?, defaultStoreId = ?, state = ?, dispatchedAt = ?, updatedById = ?, updatedAt = ?
         WHERE id = ?`
    ).run(
        params.slotCount ?? existing.slotCount,
        params.defaultStoreId !== undefined ? params.defaultStoreId : existing.defaultStoreId,
        params.state ?? existing.state,
        params.dispatchedAt !== undefined ? params.dispatchedAt : existing.dispatchedAt,
        params.updatedById,
        now,
        params.id
    );

    return getPlanById(params.id);
}

export function deletePlan(id: string): boolean {
    const result = db.prepare(`DELETE FROM Plan WHERE id = ?`).run(id);
    return result.changes > 0;
}

// ========== PlanSlot Operations ==========

export function getSlotsByPlan(planId: string): PlanSlot[] {
    const rows = db
        .prepare(
            `SELECT id, planId, slotNumber, tagIds, maxCookingTimeMinutes, pickedRecipeId, pinned, createdAt, updatedAt
             FROM PlanSlot
             WHERE planId = ?
             ORDER BY slotNumber ASC`
        )
        .all(planId) as PlanSlotRow[];

    return rows.map(mapSlot);
}

export function upsertSlots(
    planId: string,
    slots: Array<{
        slotNumber: number;
        tagIds: string[];
        maxCookingTimeMinutes?: number | null;
        pickedRecipeId?: string | null;
        pinned?: boolean;
    }>
): void {
    const now = new Date().toISOString();

    const upsert = db.prepare(
        `INSERT INTO PlanSlot (id, planId, slotNumber, tagIds, maxCookingTimeMinutes, pickedRecipeId, pinned, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(planId, slotNumber) DO UPDATE SET
             tagIds = excluded.tagIds,
             maxCookingTimeMinutes = excluded.maxCookingTimeMinutes,
             pickedRecipeId = excluded.pickedRecipeId,
             pinned = excluded.pinned,
             updatedAt = excluded.updatedAt`
    );

    const run = db.transaction(() => {
        for (const s of slots) {
            upsert.run(
                crypto.randomUUID(),
                planId,
                s.slotNumber,
                JSON.stringify(s.tagIds ?? []),
                s.maxCookingTimeMinutes ?? null,
                s.pickedRecipeId ?? null,
                boolToInt(s.pinned),
                now,
                now
            );
        }
    });
    run();
}

export function setSlotPick(
    planId: string,
    slotNumber: number,
    pickedRecipeId: string | null
): void {
    const now = new Date().toISOString();
    db.prepare(
        `UPDATE PlanSlot SET pickedRecipeId = ?, pinned = CASE WHEN ? IS NULL THEN NULL ELSE pinned END, updatedAt = ? WHERE planId = ? AND slotNumber = ?`
    ).run(pickedRecipeId, pickedRecipeId, now, planId, slotNumber);
}

export function deleteExtraSlots(planId: string, keepUpTo: number): void {
    db.prepare(`DELETE FROM PlanSlot WHERE planId = ? AND slotNumber > ?`).run(planId, keepUpTo);
}

// ========== PlanIngredientRoute Operations ==========

export function getRoutesByPlan(planId: string): PlanIngredientRoute[] {
    const rows = db
        .prepare(
            `SELECT id, planId, ingredientId, storeId, overridden, checked, isUnsure, createdAt, updatedAt
             FROM PlanIngredientRoute
             WHERE planId = ?`
        )
        .all(planId) as PlanIngredientRouteRow[];

    return rows.map(mapRoute);
}

export function upsertRoutes(
    planId: string,
    routes: Array<{
        ingredientId: string;
        storeId?: string | null;
        overridden?: boolean;
        checked?: boolean;
        isUnsure?: boolean | null;
    }>
): void {
    const now = new Date().toISOString();

    const upsert = db.prepare(
        `INSERT INTO PlanIngredientRoute (id, planId, ingredientId, storeId, overridden, checked, isUnsure, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(planId, ingredientId) DO UPDATE SET
             storeId = excluded.storeId,
             overridden = excluded.overridden,
             checked = excluded.checked,
             isUnsure = excluded.isUnsure,
             updatedAt = excluded.updatedAt`
    );

    const run = db.transaction(() => {
        for (const r of routes) {
            upsert.run(
                crypto.randomUUID(),
                planId,
                r.ingredientId,
                r.storeId ?? null,
                boolToInt(r.overridden),
                boolToInt(r.checked),
                boolToInt(r.isUnsure ?? null),
                now,
                now
            );
        }
    });
    run();
}

// ========== Plan History ==========

export function getPlansHistory(
    householdId: string,
    limit: number,
    offset: number
): {
    plans: Array<Plan & { slots: Array<{ slotNumber: number; recipeName: string | null }> }>;
    total: number;
} {
    const total = (
        db
            .prepare(
                `SELECT COUNT(*) as count FROM Plan WHERE householdId = ? AND state = 'active'`
            )
            .get(householdId) as { count: number }
    ).count;

    const planRows = db
        .prepare(
            `SELECT id, householdId, state, slotCount, defaultStoreId, dispatchedAt,
                    createdById, updatedById, createdAt, updatedAt
             FROM Plan
             WHERE householdId = ? AND state = 'active'
             ORDER BY dispatchedAt DESC
             LIMIT ? OFFSET ?`
        )
        .all(householdId, limit, offset) as Plan[];

    if (planRows.length === 0) return { plans: [], total };

    const planIds = planRows.map((r) => r.id);
    const placeholders = planIds.map(() => "?").join(", ");

    const slotRows = db
        .prepare(
            `SELECT ps.planId, ps.slotNumber, r.name as recipeName
             FROM PlanSlot ps
             LEFT JOIN Recipe r ON r.id = ps.pickedRecipeId
             WHERE ps.planId IN (${placeholders})
             ORDER BY ps.planId, ps.slotNumber ASC`
        )
        .all(...planIds) as Array<{
        planId: string;
        slotNumber: number;
        recipeName: string | null;
    }>;

    const slotsByPlan = new Map<string, Array<{ slotNumber: number; recipeName: string | null }>>();
    for (const row of slotRows) {
        const list = slotsByPlan.get(row.planId) ?? [];
        list.push({ slotNumber: row.slotNumber, recipeName: row.recipeName ?? null });
        slotsByPlan.set(row.planId, list);
    }

    const plans = planRows.map((row) => ({
        ...mapPlan(row),
        slots: slotsByPlan.get(row.id) ?? [],
    }));

    return { plans, total };
}

// ========== Row mappers ==========

function mapPlan(row: Plan): Plan {
    return {
        id: row.id,
        householdId: row.householdId,
        state: row.state,
        slotCount: row.slotCount,
        defaultStoreId: row.defaultStoreId ?? null,
        dispatchedAt: row.dispatchedAt ?? null,
        createdById: row.createdById,
        updatedById: row.updatedById,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function mapSlot(row: PlanSlotRow): PlanSlot {
    return {
        id: row.id,
        planId: row.planId,
        slotNumber: row.slotNumber,
        tagIds: JSON.parse(row.tagIds ?? "[]"),
        maxCookingTimeMinutes: row.maxCookingTimeMinutes ?? null,
        pickedRecipeId: row.pickedRecipeId ?? null,
        pinned: intToBool(row.pinned),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function mapRoute(row: PlanIngredientRouteRow): PlanIngredientRoute {
    return {
        id: row.id,
        planId: row.planId,
        ingredientId: row.ingredientId,
        storeId: row.storeId ?? null,
        overridden: intToBool(row.overridden),
        checked: intToBool(row.checked),
        isUnsure: intToBool(row.isUnsure),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
