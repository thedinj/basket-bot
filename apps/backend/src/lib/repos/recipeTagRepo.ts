import type { Recipe, RecipeTag, TagPaletteKey } from "@basket-bot/core";
import { TAG_PALETTE_KEYS } from "@basket-bot/core";
import { db } from "../db/db";
import { intToBool } from "../utils/sqliteUtils";

function randomPaletteKey(): TagPaletteKey {
    return TAG_PALETTE_KEYS[Math.floor(Math.random() * TAG_PALETTE_KEYS.length)];
}

// ========== RecipeTag CRUD Operations ==========

export function createTag(params: {
    householdId: string;
    name: string;
    colorKey?: TagPaletteKey | null;
    createdById: string;
}): RecipeTag {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const colorKey = params.colorKey ?? randomPaletteKey();

    db.prepare(
        `INSERT INTO RecipeTag (id, householdId, name, colorKey, createdById, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, params.householdId, params.name, colorKey, params.createdById, now);

    return getTagById(id)!;
}

export function getTagById(id: string): RecipeTag | null {
    const row = db
        .prepare(
            `SELECT id, householdId, name, colorKey, createdById, createdAt
             FROM RecipeTag
             WHERE id = ?`
        )
        .get(id) as RecipeTag | undefined;

    return row ?? null;
}

export function getTagsByHousehold(householdId: string): RecipeTag[] {
    const rows = db
        .prepare(
            `SELECT id, householdId, name, colorKey, createdById, createdAt
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
    colorKey?: TagPaletteKey | null;
}): RecipeTag | null {
    const existing = getTagById(params.id);
    if (!existing) return null;

    db.prepare(
        `UPDATE RecipeTag
         SET name = ?, colorKey = ?
         WHERE id = ?`
    ).run(
        params.name ?? existing.name,
        params.colorKey !== undefined ? params.colorKey : existing.colorKey,
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
            `SELECT rt.id, rt.householdId, rt.name, rt.colorKey, rt.createdById, rt.createdAt
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
