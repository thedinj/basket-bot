import type { Recipe, RecipeWithDetails } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for Recipe entity operations.
 * Handles all database access for recipes.
 */

// ========== Boolean Conversion Helpers ==========
// SQLite stores booleans as integers (1) or null
// We use null for false to save space and make intent clearer

/**
 * Convert a boolean to SQLite value (1 for true, null for false)
 */
function boolToInt(value: boolean | null | undefined): number | null {
    if (value == null || !value) return null;
    return 1;
}

/**
 * Convert SQLite value to boolean (1 → true, null/0 → false)
 */
function intToBool(value: number | null | undefined): boolean {
    if (value == null) return false;
    return value !== 0;
}

// ========== Recipe CRUD Operations ==========

export function createRecipe(params: {
    householdId: string;
    name: string;
    description?: string | null;
    steps?: string | null;
    sourceUrl?: string | null;
    createdById: string;
}): Recipe {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Recipe (id, householdId, name, description, steps, sourceUrl, isHidden, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.householdId,
        params.name,
        params.description ?? null,
        params.steps ?? null,
        params.sourceUrl ?? null,
        null, // isHidden defaults to false (NULL)
        params.createdById,
        params.createdById,
        now,
        now
    );

    return getRecipeById(id)!;
}

export function getRecipeById(id: string): Recipe | null {
    const row = db
        .prepare(
            `SELECT id, householdId, name, description, steps, sourceUrl, isHidden, createdById, updatedById, createdAt, updatedAt
             FROM Recipe
             WHERE id = ?`
        )
        .get(id) as (Omit<Recipe, "isHidden"> & { isHidden: number | null }) | undefined;

    if (!row) return null;

    return {
        ...row,
        isHidden: intToBool(row.isHidden),
    };
}

export function getRecipesByHousehold(
    householdId: string,
    includeHidden: boolean = false
): Recipe[] {
    let query = `SELECT id, householdId, name, description, steps, sourceUrl, isHidden, createdById, updatedById, createdAt, updatedAt
                 FROM Recipe
                 WHERE householdId = ?`;

    if (!includeHidden) {
        query += ` AND (isHidden IS NULL OR isHidden = 0)`;
    }

    query += ` ORDER BY name ASC`;

    const rows = db.prepare(query).all(householdId) as Array<
        Omit<Recipe, "isHidden"> & { isHidden: number | null }
    >;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
    }));
}

export function updateRecipe(params: {
    id: string;
    name?: string;
    description?: string | null;
    steps?: string | null;
    sourceUrl?: string | null;
    updatedById: string;
}): Recipe | null {
    const existing = getRecipeById(params.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    db.prepare(
        `UPDATE Recipe
         SET name = ?, description = ?, steps = ?, sourceUrl = ?, updatedById = ?, updatedAt = ?
         WHERE id = ?`
    ).run(
        params.name ?? existing.name,
        params.description !== undefined ? params.description : existing.description,
        params.steps !== undefined ? params.steps : existing.steps,
        params.sourceUrl !== undefined ? params.sourceUrl : existing.sourceUrl,
        params.updatedById,
        now,
        params.id
    );

    return getRecipeById(params.id);
}

export function deleteRecipe(id: string): boolean {
    const result = db.prepare(`DELETE FROM Recipe WHERE id = ?`).run(id);
    return result.changes > 0;
}

export function hideRecipe(id: string, userId: string): Recipe | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE Recipe
             SET isHidden = 1, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(userId, now, id);

    if (result.changes === 0) return null;

    return getRecipeById(id);
}

export function unhideRecipe(id: string, userId: string): Recipe | null {
    const now = new Date().toISOString();

    const result = db
        .prepare(
            `UPDATE Recipe
             SET isHidden = NULL, updatedById = ?, updatedAt = ?
             WHERE id = ?`
        )
        .run(userId, now, id);

    if (result.changes === 0) return null;

    return getRecipeById(id);
}

// ========== Recipe with Details ==========

export function getRecipeWithDetails(id: string): RecipeWithDetails | null {
    const recipe = getRecipeById(id);
    if (!recipe) return null;

    // Get tags
    const tagRows = db
        .prepare(
            `SELECT rt.id, rt.householdId, rt.name, rt.color, rt.createdById, rt.createdAt
             FROM RecipeTag rt
             INNER JOIN RecipeTagAssignment rta ON rta.tagId = rt.id
             WHERE rta.recipeId = ?
             ORDER BY rt.name ASC`
        )
        .all(id) as any[];

    // Get ingredients
    const ingredientRows = db
        .prepare(
            `SELECT id, recipeId, name, qty, unitId, sortOrder, notes, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE recipeId = ?
             ORDER BY sortOrder ASC`
        )
        .all(id) as any[];

    return {
        ...recipe,
        tags: tagRows,
        ingredients: ingredientRows,
    };
}

// ========== Tag-based Search ==========

/**
 * Search recipes by tags (AND filter - recipe must have all specified tags)
 */
export function searchRecipesByTags(householdId: string, tagIds: string[]): Recipe[] {
    if (tagIds.length === 0) {
        return getRecipesByHousehold(householdId);
    }

    // Build query with AND logic (recipe must have all tags)
    // Count how many of the specified tags each recipe has, and filter to only those with all tags
    const placeholders = tagIds.map(() => "?").join(",");
    const query = `
        SELECT DISTINCT r.id, r.householdId, r.name, r.description, r.steps, r.sourceUrl, r.isHidden, r.createdById, r.updatedById, r.createdAt, r.updatedAt
        FROM Recipe r
        INNER JOIN RecipeTagAssignment rta ON rta.recipeId = r.id
        WHERE r.householdId = ?
          AND (r.isHidden IS NULL OR r.isHidden = 0)
          AND rta.tagId IN (${placeholders})
        GROUP BY r.id
        HAVING COUNT(DISTINCT rta.tagId) = ?
        ORDER BY r.name ASC
    `;

    const rows = db.prepare(query).all(householdId, ...tagIds, tagIds.length) as Array<
        Omit<Recipe, "isHidden"> & { isHidden: number | null }
    >;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
    }));
}
