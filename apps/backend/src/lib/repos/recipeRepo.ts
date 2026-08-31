import type { Recipe, RecipeIngredient, RecipeTag, RecipeWithDetails } from "@basket-bot/core";
import { db } from "../db/db";
import { intToBool } from "../utils/sqliteUtils";

/**
 * Repository for Recipe entity operations.
 * Handles all database access for recipes.
 */

// ========== Recipe CRUD Operations ==========

export function createRecipe(params: {
    householdId: string;
    name: string;
    source?: string | null;
    description?: string | null;
    steps?: string | null;
    sourceUrl?: string | null;
    isPoolExcluded?: boolean | null;
    cookingTimeMinutes?: number | null;
    createdById: string;
}): Recipe {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
        `INSERT INTO Recipe (id, householdId, name, source, description, steps, sourceUrl, isHidden, isPoolExcluded, cookingTimeMinutes, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        params.householdId,
        params.name,
        params.source ?? null,
        params.description ?? null,
        params.steps ?? null,
        params.sourceUrl ?? null,
        null, // isHidden defaults to false (NULL)
        params.isPoolExcluded ? 1 : null,
        params.cookingTimeMinutes ?? null,
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
            `SELECT id, householdId, name, source, description, steps, sourceUrl, isHidden, isPoolExcluded, cookingTimeMinutes, createdById, updatedById, createdAt, updatedAt
             FROM Recipe
             WHERE id = ?`
        )
        .get(id) as
        | (Omit<Recipe, "isHidden" | "isPoolExcluded"> & {
              isHidden: number | null;
              isPoolExcluded: number | null;
          })
        | undefined;

    if (!row) return null;

    return {
        ...row,
        isHidden: intToBool(row.isHidden),
        isPoolExcluded: intToBool(row.isPoolExcluded),
    };
}

export function getRecipesByHousehold(
    householdId: string,
    includeHidden: boolean = false
): Recipe[] {
    let query = `SELECT id, householdId, name, source, description, steps, sourceUrl, isHidden, isPoolExcluded, cookingTimeMinutes, createdById, updatedById, createdAt, updatedAt
                 FROM Recipe
                 WHERE householdId = ?`;

    if (!includeHidden) {
        query += ` AND (isHidden IS NULL OR isHidden = 0)`;
    }

    query += ` ORDER BY name ASC`;

    const rows = db.prepare(query).all(householdId) as Array<
        Omit<Recipe, "isHidden" | "isPoolExcluded"> & {
            isHidden: number | null;
            isPoolExcluded: number | null;
        }
    >;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
        isPoolExcluded: intToBool(row.isPoolExcluded),
    }));
}

export function updateRecipe(params: {
    id: string;
    name?: string;
    source?: string | null;
    description?: string | null;
    steps?: string | null;
    sourceUrl?: string | null;
    isPoolExcluded?: boolean | null;
    cookingTimeMinutes?: number | null;
    updatedById: string;
}): Recipe | null {
    const existing = getRecipeById(params.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const newIsPoolExcluded =
        params.isPoolExcluded !== undefined
            ? params.isPoolExcluded
                ? 1
                : null
            : existing.isPoolExcluded
              ? 1
              : null;

    db.prepare(
        `UPDATE Recipe
         SET name = ?, source = ?, description = ?, steps = ?, sourceUrl = ?, isPoolExcluded = ?, cookingTimeMinutes = ?, updatedById = ?, updatedAt = ?
         WHERE id = ?`
    ).run(
        params.name ?? existing.name,
        params.source !== undefined ? params.source : existing.source,
        params.description !== undefined ? params.description : existing.description,
        params.steps !== undefined ? params.steps : existing.steps,
        params.sourceUrl !== undefined ? params.sourceUrl : existing.sourceUrl,
        newIsPoolExcluded,
        params.cookingTimeMinutes !== undefined
            ? params.cookingTimeMinutes
            : existing.cookingTimeMinutes,
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
            `SELECT rt.id, rt.householdId, rt.name, rt.colorKey, rt.createdById, rt.createdAt
             FROM RecipeTag rt
             INNER JOIN RecipeTagAssignment rta ON rta.tagId = rt.id
             WHERE rta.recipeId = ?
             ORDER BY rt.name ASC`
        )
        .all(id) as RecipeTag[];

    // Get ingredients
    const ingredientRows = db
        .prepare(
            `SELECT id, recipeId, name, shoppingName, qty, shoppingQty, unitId, shoppingUnitId, sortOrder, notes, excluded, isUnsure, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE recipeId = ?
             ORDER BY sortOrder ASC`
        )
        .all(id) as Array<
        Omit<RecipeIngredient, "excluded" | "isUnsure"> & { excluded: 1 | null; isUnsure: 1 | null }
    >;

    return {
        ...recipe,
        tags: tagRows,
        ingredients: ingredientRows.map((r) => ({
            ...r,
            excluded: r.excluded === 1,
            isUnsure: r.isUnsure === 1 ? true : null,
        })),
    };
}

export function getRecipesWithDetailsByHousehold(householdId: string): RecipeWithDetails[] {
    const recipes = getRecipesByHousehold(householdId);
    if (recipes.length === 0) return [];

    const ids = recipes.map((r) => r.id);
    const ph = ids.map(() => "?").join(",");

    const tagRows = db
        .prepare(
            `SELECT rta.recipeId, rt.id, rt.householdId, rt.name, rt.colorKey, rt.createdById, rt.createdAt
             FROM RecipeTagAssignment rta
             INNER JOIN RecipeTag rt ON rt.id = rta.tagId
             WHERE rta.recipeId IN (${ph})
             ORDER BY rt.name ASC`
        )
        .all(...ids) as Array<RecipeTag & { recipeId: string }>;

    const ingRows = db
        .prepare(
            `SELECT id, recipeId, name, shoppingName, qty, shoppingQty, unitId, shoppingUnitId, sortOrder, notes, excluded, isUnsure, createdById, updatedById, createdAt, updatedAt
             FROM RecipeIngredient
             WHERE recipeId IN (${ph})
             ORDER BY sortOrder ASC, name ASC`
        )
        .all(...ids) as Array<
        Omit<RecipeIngredient, "excluded" | "isUnsure"> & {
            recipeId: string;
            excluded: 1 | null;
            isUnsure: 1 | null;
        }
    >;

    const tagsByRecipe = new Map<string, RecipeTag[]>();
    for (const row of tagRows) {
        const { recipeId, ...tag } = row;
        if (!tagsByRecipe.has(recipeId)) tagsByRecipe.set(recipeId, []);
        tagsByRecipe.get(recipeId)!.push(tag as RecipeTag);
    }

    const ingsByRecipe = new Map<string, RecipeIngredient[]>();
    for (const row of ingRows) {
        const { recipeId, ...rest } = row;
        if (!ingsByRecipe.has(recipeId)) ingsByRecipe.set(recipeId, []);
        ingsByRecipe.get(recipeId)!.push({
            ...rest,
            recipeId,
            excluded: rest.excluded === 1,
            isUnsure: rest.isUnsure === 1 ? true : null,
        });
    }

    return recipes.map((recipe) => ({
        ...recipe,
        tags: tagsByRecipe.get(recipe.id) ?? [],
        ingredients: ingsByRecipe.get(recipe.id) ?? [],
    }));
}

// ========== Tag-based Search ==========

/**
 * Search recipes by tags (AND logic) and optional max cooking time.
 * Recipes with null cookingTimeMinutes fail the maxCookingTimeMinutes filter when it is set.
 */
export function searchRecipes(
    householdId: string,
    tagIds: string[],
    maxCookingTimeMinutes?: number | null
): Recipe[] {
    const hasTagFilter = tagIds.length > 0;
    const hasTimeFilter = maxCookingTimeMinutes != null;

    if (!hasTagFilter && !hasTimeFilter) {
        const rows = db
            .prepare(
                `SELECT id, householdId, name, source, description, steps, sourceUrl, isHidden, isPoolExcluded, cookingTimeMinutes, createdById, updatedById, createdAt, updatedAt
                 FROM Recipe
                 WHERE householdId = ?
                   AND (isHidden IS NULL OR isHidden = 0)
                   AND isPoolExcluded IS NULL
                 ORDER BY name ASC`
            )
            .all(householdId) as Array<
            Omit<Recipe, "isHidden" | "isPoolExcluded"> & {
                isHidden: number | null;
                isPoolExcluded: number | null;
            }
        >;
        return rows.map((row) => ({
            ...row,
            isHidden: intToBool(row.isHidden),
            isPoolExcluded: intToBool(row.isPoolExcluded),
        }));
    }

    const binds: unknown[] = [householdId];
    let query: string;

    if (hasTagFilter) {
        const placeholders = tagIds.map(() => "?").join(",");
        query = `
            SELECT r.id, r.householdId, r.name, r.source, r.description, r.steps, r.sourceUrl, r.isHidden, r.isPoolExcluded, r.cookingTimeMinutes, r.createdById, r.updatedById, r.createdAt, r.updatedAt
            FROM Recipe r
            INNER JOIN RecipeTagAssignment rta ON rta.recipeId = r.id
            WHERE r.householdId = ?
              AND (r.isHidden IS NULL OR r.isHidden = 0)
              AND r.isPoolExcluded IS NULL
              AND rta.tagId IN (${placeholders})
            GROUP BY r.id
            HAVING COUNT(DISTINCT rta.tagId) = ?
        `;
        binds.push(...tagIds, tagIds.length);
    } else {
        query = `
            SELECT id, householdId, name, source, description, steps, sourceUrl, isHidden, isPoolExcluded, cookingTimeMinutes, createdById, updatedById, createdAt, updatedAt
            FROM Recipe
            WHERE householdId = ?
              AND (isHidden IS NULL OR isHidden = 0)
              AND isPoolExcluded IS NULL
        `;
    }

    const col = hasTagFilter ? "r.cookingTimeMinutes" : "cookingTimeMinutes";

    if (hasTimeFilter) {
        query += ` AND (${col} IS NOT NULL AND ${col} <= ?)`;
        binds.push(maxCookingTimeMinutes);
    }

    query += ` ORDER BY ${hasTagFilter ? "r." : ""}name ASC`;

    const rows = db.prepare(query).all(...binds) as Array<
        Omit<Recipe, "isHidden" | "isPoolExcluded"> & {
            isHidden: number | null;
            isPoolExcluded: number | null;
        }
    >;

    return rows.map((row) => ({
        ...row,
        isHidden: intToBool(row.isHidden),
        isPoolExcluded: intToBool(row.isPoolExcluded),
    }));
}

export function searchRecipesByTags(householdId: string, tagIds: string[]): Recipe[] {
    return searchRecipes(householdId, tagIds, null);
}
