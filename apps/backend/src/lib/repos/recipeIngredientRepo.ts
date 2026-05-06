import type { RecipeIngredient } from "@basket-bot/core";
import { db } from "../db/db";
import { normalizeItemName } from "../utils/stringUtils";

/**
 * Repository for RecipeIngredient entity operations.
 * Handles ingredients for recipes with sortOrder for display.
 */

type RawRow = Omit<RecipeIngredient, "excluded"> & { excluded: 1 | null };

function mapRow(row: RawRow): RecipeIngredient {
    return { ...row, excluded: row.excluded === 1 };
}

// ========== RecipeIngredient CRUD Operations ==========

export function addIngredient(params: {
    recipeId: string;
    name: string;
    shoppingName?: string | null;
    qty?: number | null;
    shoppingQty?: number | null;
    unitId?: string | null;
    shoppingUnitId?: string | null;
    sortOrder?: number;
    notes?: string | null;
    excluded?: boolean;
    createdById: string;
}): RecipeIngredient {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const shoppingName =
        params.shoppingName && normalizeItemName(params.shoppingName) !== normalizeItemName(params.name)
            ? params.shoppingName.trim()
            : null;

    const recipeQty = params.qty ?? null;
    const recipeUnitId = params.unitId ?? null;
    const rawShoppingQty = params.shoppingQty ?? null;
    const rawShoppingUnitId = params.shoppingUnitId ?? null;
    const sameAsRecipe = rawShoppingQty === recipeQty && rawShoppingUnitId === recipeUnitId;
    const shoppingQty = sameAsRecipe ? null : rawShoppingQty;
    const shoppingUnitId = sameAsRecipe ? null : rawShoppingUnitId;

    db.prepare(
        `INSERT INTO RecipeIngredient (id, recipeId, name, shoppingName, qty, shoppingQty, unitId, shoppingUnitId, sortOrder, notes, excluded, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.recipeId,
        params.name,
        shoppingName,
        recipeQty,
        shoppingQty,
        recipeUnitId,
        shoppingUnitId,
        params.sortOrder ?? 0,
        params.notes ?? null,
        params.excluded ? 1 : null,
        params.createdById,
        params.createdById,
        now,
        now
    );

    return getIngredientById(id)!;
}

export function getIngredientById(id: string): RecipeIngredient | null {
    const row = db
        .prepare(
            `SELECT id, recipeId, name, shoppingName, qty, shoppingQty, unitId, shoppingUnitId, sortOrder, notes, excluded, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE id = ?`
        )
        .get(id) as RawRow | undefined;

    return row ? mapRow(row) : null;
}

export function getIngredientsByRecipe(recipeId: string): RecipeIngredient[] {
    const rows = db
        .prepare(
            `SELECT id, recipeId, name, shoppingName, qty, shoppingQty, unitId, shoppingUnitId, sortOrder, notes, excluded, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE recipeId = ?
             ORDER BY sortOrder ASC, name ASC`
        )
        .all(recipeId) as RawRow[];

    return rows.map(mapRow);
}

export function updateIngredient(params: {
    id: string;
    name?: string;
    shoppingName?: string | null;
    qty?: number | null;
    shoppingQty?: number | null;
    unitId?: string | null;
    shoppingUnitId?: string | null;
    sortOrder?: number;
    notes?: string | null;
    excluded?: boolean;
    updatedById: string;
}): RecipeIngredient | null {
    const existing = getIngredientById(params.id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const resolvedName = params.name ?? existing.name;
    const resolvedQty = params.qty !== undefined ? (params.qty ?? null) : (existing.qty ?? null);
    const resolvedUnitId = params.unitId !== undefined ? (params.unitId ?? null) : (existing.unitId ?? null);

    const excluded =
        params.excluded !== undefined ? (params.excluded ? 1 : null) : existing.excluded ? 1 : null;

    let shoppingName: string | null;
    if (params.shoppingName !== undefined) {
        shoppingName =
            params.shoppingName && normalizeItemName(params.shoppingName) !== normalizeItemName(resolvedName)
                ? params.shoppingName.trim()
                : null;
    } else {
        shoppingName = existing.shoppingName;
    }

    let shoppingQty: number | null;
    let shoppingUnitId: string | null;
    if (params.shoppingQty !== undefined || params.shoppingUnitId !== undefined) {
        const rawShoppingQty = params.shoppingQty !== undefined ? (params.shoppingQty ?? null) : existing.shoppingQty;
        const rawShoppingUnitId = params.shoppingUnitId !== undefined ? (params.shoppingUnitId ?? null) : existing.shoppingUnitId;
        const sameAsRecipe = rawShoppingQty === resolvedQty && rawShoppingUnitId === resolvedUnitId;
        shoppingQty = sameAsRecipe ? null : rawShoppingQty;
        shoppingUnitId = sameAsRecipe ? null : rawShoppingUnitId;
    } else {
        shoppingQty = existing.shoppingQty;
        shoppingUnitId = existing.shoppingUnitId;
    }

    db.prepare(
        `UPDATE RecipeIngredient
         SET name = ?, shoppingName = ?, qty = ?, shoppingQty = ?, unitId = ?, shoppingUnitId = ?, sortOrder = ?, notes = ?, excluded = ?, updatedById = ?, updatedAt = ?
         WHERE id = ?`
    ).run(
        resolvedName,
        shoppingName,
        resolvedQty,
        shoppingQty,
        resolvedUnitId,
        shoppingUnitId,
        params.sortOrder !== undefined ? params.sortOrder : existing.sortOrder,
        params.notes !== undefined ? params.notes : existing.notes,
        excluded,
        params.updatedById,
        now,
        params.id
    );

    return getIngredientById(params.id);
}

export function deleteIngredient(id: string): boolean {
    const result = db.prepare(`DELETE FROM RecipeIngredient WHERE id = ?`).run(id);
    return result.changes > 0;
}

// ========== Ingredient Reordering ==========

/**
 * Bulk update sortOrder for ingredients
 * @param recipeId - Recipe containing the ingredients
 * @param ingredientIds - Array of ingredient IDs in desired order (0-indexed)
 */
export function reorderIngredients(recipeId: string, ingredientIds: string[]): void {
    db.transaction(() => {
        const updateStmt = db.prepare(
            `UPDATE RecipeIngredient
             SET sortOrder = ?
             WHERE id = ? AND recipeId = ?`
        );

        ingredientIds.forEach((ingredientId, index) => {
            updateStmt.run(index, ingredientId, recipeId);
        });
    })();
}
