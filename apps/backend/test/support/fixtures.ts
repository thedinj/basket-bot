import { normalizeItemName } from "../../src/lib/utils/stringUtils";
import { db } from "../../src/lib/db/db";

/**
 * Row factories for backend suites, in the same `makeX(overrides)` shape as
 * `apps/mobile/src/utils/shoppingListDerivations.test.ts`.
 *
 * These write SQL directly rather than going through the repos on purpose: a test for
 * `itemRepo.updateItem` should not depend on `itemRepo.insertItem` being correct. Use
 * `seedDefaultStore` when you want the realistic shape the real seeding code produces.
 *
 * Two data-model rules from CLAUDE.md are enforced here rather than left to each caller:
 *  - booleans are `1` or `NULL`, never `0`
 *  - if an item has a section, the section's aisle is authoritative and the item's own
 *    `aisleId` is NULL
 */

/** Booleans are stored as 1/NULL, never 0. */
export const bool = (value: boolean | undefined): 1 | null => (value ? 1 : null);

const now = (): string => new Date().toISOString();

export const seedUser = (
    overrides: { id?: string; email?: string; name?: string; scopes?: string } = {}
): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "User" (id, email, name, password, scopes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.email ?? `${id}@example.test`,
        overrides.name ?? "Test User",
        "hashed-password",
        overrides.scopes ?? "",
        now(),
        now()
    );
    return id;
};

export const seedHousehold = (overrides: {
    id?: string;
    name?: string;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "Household" (id, name, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.name ?? "Test Household",
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

export const seedHouseholdMember = (overrides: { householdId: string; userId: string }): void => {
    db.prepare(
        `INSERT INTO "HouseholdMember" (id, householdId, userId, createdAt) VALUES (?, ?, ?, ?)`
    ).run(crypto.randomUUID(), overrides.householdId, overrides.userId, now());
};

export const seedStore = (overrides: {
    id?: string;
    name?: string;
    ownerId: string;
    householdId?: string | null;
    isHidden?: boolean;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "Store" (id, name, householdId, isHidden, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.name ?? "Test Store",
        overrides.householdId ?? null,
        bool(overrides.isHidden),
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

export const seedAisle = (overrides: {
    id?: string;
    storeId: string;
    name?: string;
    sortOrder?: number;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    const name = overrides.name ?? "Test Aisle";
    db.prepare(
        `INSERT INTO "StoreAisle" (id, storeId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.storeId,
        name,
        normalizeItemName(name),
        overrides.sortOrder ?? 0,
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

export const seedSection = (overrides: {
    id?: string;
    storeId: string;
    aisleId: string;
    name?: string;
    sortOrder?: number;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    const name = overrides.name ?? "Test Section";
    db.prepare(
        `INSERT INTO "StoreSection" (id, storeId, aisleId, name, nameNorm, sortOrder, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.storeId,
        overrides.aisleId,
        name,
        normalizeItemName(name),
        overrides.sortOrder ?? 0,
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

export const seedItem = (overrides: {
    id?: string;
    storeId: string;
    name?: string;
    aisleId?: string | null;
    sectionId?: string | null;
    isFavorite?: boolean;
    usageCount?: number;
    ownerId: string;
}): string => {
    if (overrides.aisleId && overrides.sectionId) {
        throw new Error(
            "seedItem: pass aisleId OR sectionId, not both — a sectioned item's aisle is " +
                "resolved through its section and its own aisleId must stay NULL."
        );
    }

    const id = overrides.id ?? crypto.randomUUID();
    const name = overrides.name ?? "Test Item";
    db.prepare(
        `INSERT INTO "StoreItem" (id, storeId, name, nameNorm, aisleId, sectionId, usageCount,
                                  isHidden, isFavorite, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.storeId,
        name,
        normalizeItemName(name),
        overrides.aisleId ?? null,
        overrides.sectionId ?? null,
        overrides.usageCount ?? 0,
        overrides.isFavorite ? 1 : 0,
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

export const seedListItem = (overrides: {
    id?: string;
    storeId: string;
    storeItemId?: string | null;
    qty?: number | null;
    unitId?: string | null;
    notes?: string | null;
    isChecked?: boolean;
    isUnsure?: boolean;
    isIdea?: boolean;
    isPrivate?: boolean;
    isSample?: boolean;
    snoozedUntil?: string | null;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "ShoppingListItem" (id, storeId, storeItemId, qty, unitId, notes, isChecked,
                                         isSample, isUnsure, isIdea, snoozedUntil, isPrivate,
                                         createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.storeId,
        overrides.storeItemId ?? null,
        overrides.qty ?? null,
        overrides.unitId ?? null,
        overrides.notes ?? null,
        bool(overrides.isChecked),
        bool(overrides.isSample),
        bool(overrides.isUnsure),
        bool(overrides.isIdea),
        overrides.snoozedUntil ?? null,
        bool(overrides.isPrivate),
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

// ========== Meals domain ==========

export const seedRecipe = (overrides: {
    id?: string;
    householdId: string;
    name?: string;
    cookingTimeMinutes?: number | null;
    isHidden?: boolean;
    isPoolExcluded?: boolean;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "Recipe" (id, householdId, name, source, description, steps, sourceUrl,
                               isHidden, isPoolExcluded, cookingTimeMinutes,
                               createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.householdId,
        overrides.name ?? "Test Recipe",
        bool(overrides.isHidden),
        bool(overrides.isPoolExcluded),
        overrides.cookingTimeMinutes ?? null,
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

export const seedTag = (overrides: {
    id?: string;
    householdId: string;
    name?: string;
    colorKey?: string | null;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "RecipeTag" (id, householdId, name, colorKey, createdById, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.householdId,
        overrides.name ?? "Test Tag",
        overrides.colorKey ?? null,
        overrides.ownerId,
        now()
    );
    return id;
};

export const seedTagAssignment = (overrides: { recipeId: string; tagId: string }): void => {
    db.prepare(
        `INSERT INTO "RecipeTagAssignment" (id, recipeId, tagId, createdAt) VALUES (?, ?, ?, ?)`
    ).run(crypto.randomUUID(), overrides.recipeId, overrides.tagId, now());
};

/**
 * `shoppingQty`/`shoppingUnitId` are the "buy this instead" override. The repo stores NULL when
 * they match the recipe quantity, and this writes exactly what it is given so a test can set up
 * either state deliberately.
 */
export const seedIngredient = (overrides: {
    id?: string;
    recipeId: string;
    name?: string;
    shoppingName?: string | null;
    qty?: number | null;
    shoppingQty?: number | null;
    unitId?: string | null;
    shoppingUnitId?: string | null;
    sortOrder?: number;
    excluded?: boolean;
    isUnsure?: boolean;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    db.prepare(
        `INSERT INTO "RecipeIngredient" (id, recipeId, name, shoppingName, qty, shoppingQty,
                                         unitId, shoppingUnitId, sortOrder, notes, excluded,
                                         isUnsure, createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.recipeId,
        overrides.name ?? "Test Ingredient",
        overrides.shoppingName ?? null,
        overrides.qty ?? null,
        overrides.shoppingQty ?? null,
        overrides.unitId ?? null,
        overrides.shoppingUnitId ?? null,
        overrides.sortOrder ?? 0,
        bool(overrides.excluded),
        bool(overrides.isUnsure),
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );
    return id;
};

/** A plan plus its `slotCount` empty slots, exactly as `planRepo.createPlan` would leave them. */
export const seedPlan = (overrides: {
    id?: string;
    householdId: string;
    slotCount?: number;
    state?: "draft" | "active" | "archived";
    defaultStoreId?: string | null;
    ownerId: string;
}): string => {
    const id = overrides.id ?? crypto.randomUUID();
    const slotCount = overrides.slotCount ?? 4;
    db.prepare(
        `INSERT INTO "Plan" (id, householdId, state, slotCount, defaultStoreId, dispatchedAt,
                             createdById, updatedById, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
    ).run(
        id,
        overrides.householdId,
        overrides.state ?? "draft",
        slotCount,
        overrides.defaultStoreId ?? null,
        overrides.ownerId,
        overrides.ownerId,
        now(),
        now()
    );

    const insertSlot = db.prepare(
        `INSERT INTO "PlanSlot" (id, planId, slotNumber, tagIds, maxCookingTimeMinutes,
                                 pickedRecipeId, pinned, createdAt, updatedAt)
         VALUES (?, ?, ?, '[]', NULL, NULL, NULL, ?, ?)`
    );
    for (let i = 1; i <= slotCount; i++) {
        insertSlot.run(crypto.randomUUID(), id, i, now(), now());
    }
    return id;
};

/**
 * The realistic store shape the app actually creates on registration (aisles, sections and
 * sample items), via the production code path. Use this when a test cares about that shape;
 * use `seedStore` + friends when it needs an exact, minimal fixture.
 */
export const seedDefaultStore = async (userId: string, userName = "Test User"): Promise<string> => {
    const storeService = await import("../../src/lib/services/storeService");
    return storeService.createDefaultStoreForNewUser(userId, userName);
};
