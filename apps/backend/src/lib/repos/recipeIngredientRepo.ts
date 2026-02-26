import type { RecipeIngredient } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for RecipeIngredient entity operations.
 * Handles ingredients for recipes with sortOrder for display.
 */

// ========== RecipeIngredient CRUD Operations ==========

export function addIngredient(params: {
    recipeId: string;
    name: string;
    qty?: number | null;
    unitId?: string | null;
    sortOrder?: number;
    notes?: string | null;
    createdById: string;
}): RecipeIngredient {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO RecipeIngredient (id, recipeId, name, qty, unitId, sortOrder, notes, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.recipeId,
        params.name,
        params.qty ?? null,
        params.unitId ?? null,
        params.sortOrder ?? 0,
        params.notes ?? null,
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
            `SELECT id, recipeId, name, qty, unitId, sortOrder, notes, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE id = ?`
        )
        .get(id) as RecipeIngredient | undefined;

    return row ?? null;
}

export function getIngredientsByRecipe(recipeId: string): RecipeIngredient[] {
    const rows = db
        .prepare(
            `SELECT id, recipeId, name, qty, unitId, sortOrder, notes, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE recipeId = ?
             ORDER BY sortOrder ASC, name ASC`
        )
        .all(recipeId) as RecipeIngredient[];

    return rows;
}

export function updateIngredient(params: {
    id: string;
    name?: string;
    qty?: number | null;
    unitId?: string | null;
    sortOrder?: number;
    notes?: string | null;
    updatedById: string;
}): RecipeIngredient | null {
    const existing = getIngredientById(params.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    db.prepare(
        `UPDATE RecipeIngredient
         SET name = ?, qty = ?, unitId = ?, sortOrder = ?, notes = ?, updatedById = ?, updatedAt = ?
         WHERE id = ?`
    ).run(
        params.name ?? existing.name,
        params.qty !== undefined ? params.qty : existing.qty,
        params.unitId !== undefined ? params.unitId : existing.unitId,
        params.sortOrder !== undefined ? params.sortOrder : existing.sortOrder,
        params.notes !== undefined ? params.notes : existing.notes,
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
