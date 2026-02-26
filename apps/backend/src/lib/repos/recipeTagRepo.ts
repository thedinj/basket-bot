import type { Recipe, RecipeTag } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for RecipeTag entity operations.
 * Handles tags and tag assignments for recipes.
 */

// ========== Boolean Conversion Helper ==========

/**
 * Convert SQLite value to boolean (1 → true, null/0 → false)
 */
function intToBool(value: number | null | undefined): boolean {
    if (value == null) return false;
    return value !== 0;
}

// ========== RecipeTag CRUD Operations ==========

export function createTag(params: {
    householdId: string;
    name: string;
    color?: string | null;
    createdById: string;
}): RecipeTag {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO RecipeTag (id, householdId, name, color, createdById, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, params.householdId, params.name, params.color ?? null, params.createdById, now);

    return getTagById(id)!;
}

export function getTagById(id: string): RecipeTag | null {
    const row = db
        .prepare(
            `SELECT id, householdId, name, color, createdById, createdAt
             FROM RecipeTag
             WHERE id = ?`
        )
        .get(id) as RecipeTag | undefined;

    return row ?? null;
}

export function getTagsByHousehold(householdId: string): RecipeTag[] {
    const rows = db
        .prepare(
            `SELECT id, householdId, name, color, createdById, createdAt
             FROM RecipeTag
             WHERE householdId = ?
             ORDER BY name ASC`
        )
        .all(householdId) as RecipeTag[];

    return rows;
}

export function updateTag(params: {
    id: string;
    name?: string;
    color?: string | null;
}): RecipeTag | null {
    const existing = getTagById(params.id);
    if (!existing) return null;

    db.prepare(
        `UPDATE RecipeTag
         SET name = ?, color = ?
         WHERE id = ?`
    ).run(
        params.name ?? existing.name,
        params.color !== undefined ? params.color : existing.color,
        params.id
    );

    return getTagById(params.id);
}

export function deleteTag(id: string): boolean {
    const result = db.prepare(`DELETE FROM RecipeTag WHERE id = ?`).run(id);
    return result.changes > 0;
}

// ========== Tag Assignment Operations ==========

export function assignTagToRecipe(recipeId: string, tagId: string): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO RecipeTagAssignment (id, recipeId, tagId, createdAt)
         VALUES (?, ?, ?, ?)`
    ).run(id, recipeId, tagId, now);
}

export function removeTagFromRecipe(recipeId: string, tagId: string): boolean {
    const result = db
        .prepare(
            `DELETE FROM RecipeTagAssignment
             WHERE recipeId = ? AND tagId = ?`
        )
        .run(recipeId, tagId);

    return result.changes > 0;
}

export function getTagsForRecipe(recipeId: string): RecipeTag[] {
    const rows = db
        .prepare(
            `SELECT rt.id, rt.householdId, rt.name, rt.color, rt.createdById, rt.createdAt
             FROM RecipeTag rt
             INNER JOIN RecipeTagAssignment rta ON rta.tagId = rt.id
             WHERE rta.recipeId = ?
             ORDER BY rt.name ASC`
        )
        .all(recipeId) as RecipeTag[];

    return rows;
}

export function getRecipesForTag(
    tagId: string
): Array<Omit<Recipe, "isHidden"> & { isHidden: boolean }> {
    const rows = db
        .prepare(
            `SELECT r.id, r.householdId, r.name, r.description, r.steps, r.sourceUrl, r.isHidden, r.createdById, r.updatedById, r.createdAt, r.updatedAt
             FROM Recipe r
             INNER JOIN RecipeTagAssignment rta ON rta.recipeId = r.id
             WHERE rta.tagId = ?
             ORDER BY r.name ASC`
        )
        .all(tagId) as Array<Omit<Recipe, "isHidden"> & { isHidden: number | null }>;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
    }));
}
