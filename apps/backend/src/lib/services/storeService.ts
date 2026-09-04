import type { Store, StoreTemplateSummary } from "@basket-bot/core";
import { AuthorizationError, ValidationError } from "@basket-bot/core";
import {
    BLANK_STORE_TEMPLATE_ID,
    getStoreTemplate,
    listStoreTemplateSummaries,
} from "../data/storeTemplates";
import * as householdRepo from "../repos/householdRepo";
import * as storeRepo from "../repos/storeRepo";

/**
 * Service layer for Store operations.
 * Enforces business logic and authorization.
 */

/**
 * The starting layouts a client can offer. See `lib/data/storeTemplates.ts`.
 */
export function listStoreTemplates(): StoreTemplateSummary[] {
    return listStoreTemplateSummaries();
}

/**
 * Create a new store. Creator has access automatically.
 * Store is private (householdId = null) by default.
 *
 * `templateId` seeds the store's aisles and sections; omitting it (or passing "blank")
 * creates an empty store. `includeSampleItems` additionally seeds the template's demo items
 * onto the shopping list — server-internal, used only for a new user's example store, so it
 * is deliberately absent from `createStoreRequestSchema`.
 */
export function createStore(params: {
    name: string;
    userId: string;
    householdId?: string | null;
    templateId?: string;
    includeSampleItems?: boolean;
}): Store {
    const templateId = params.templateId ?? BLANK_STORE_TEMPLATE_ID;
    const template = getStoreTemplate(templateId);

    if (!template) {
        throw new ValidationError(`Unknown store template "${templateId}"`);
    }

    return storeRepo.createStoreFromTemplate({
        name: params.name,
        createdById: params.userId,
        householdId: params.householdId ?? null,
        template,
        includeSampleItems: params.includeSampleItems ?? false,
    });
}

/**
 * Create a default example store for a new user (used during registration).
 * Same template path as any other store, plus the sample items that make a brand-new
 * account's shopping list look populated.
 */
export function createDefaultStoreForNewUser(userId: string, userName: string): string {
    return createStore({
        name: `${userName}'s Example Store`,
        userId,
        templateId: "grocery",
        includeSampleItems: true,
    }).id;
}

/**
 * Get all stores for a user
 */
export function getStoresByUser(userId: string): Store[] {
    return storeRepo.getStoresByUser(userId);
}

/**
 * Get a store by ID (requires collaborator access)
 */
export function getStoreById(id: string, userId: string): Store | null {
    const store = storeRepo.getStoreById(id);

    if (!store) {
        return null;
    }

    // Verify user has access
    if (!storeRepo.userHasAccessToStore(userId, id)) {
        throw new AuthorizationError("Access denied");
    }

    return store;
}

/**
 * Update a store name (requires access)
 */
export function updateStore(params: { id: string; name: string; userId: string }): Store | null {
    // Verify user has access
    if (!storeRepo.userHasAccessToStore(params.userId, params.id)) {
        throw new AuthorizationError("Access denied");
    }

    return storeRepo.updateStore({
        id: params.id,
        name: params.name,
        updatedById: params.userId,
    });
}

/**
 * Delete a store (requires access)
 */
export function deleteStore(id: string, userId: string): boolean {
    // Verify user has access
    if (!storeRepo.userHasAccessToStore(userId, id)) {
        throw new AuthorizationError("Access denied");
    }

    return storeRepo.deleteStore(id);
}

/**
 * Duplicate a store with its layout (aisles/sections) and optionally items.
 * User must have access to source store. New store is owned only by duplicating user.
 */
export function duplicateStore(params: {
    sourceStoreId: string;
    newStoreName: string;
    userId: string;
    includeItems: boolean;
}): Store {
    // Verify user has access to source store
    if (!storeRepo.userHasAccessToStore(params.userId, params.sourceStoreId)) {
        throw new AuthorizationError("Access denied");
    }

    return storeRepo.duplicateStore({
        sourceStoreId: params.sourceStoreId,
        newStoreName: params.newStoreName,
        userId: params.userId,
        includeItems: params.includeItems,
    });
}

/**
 * Update a store's household association (share with household or make private).
 * Requires access to the store.
 */
export function updateStoreHousehold(params: {
    storeId: string;
    householdId: string | null;
    userId: string;
}): Store | null {
    const store = storeRepo.getStoreById(params.storeId);

    if (!store) {
        return null;
    }

    // Verify user has access to the store
    if (!storeRepo.userHasAccessToStore(params.userId, params.storeId)) {
        throw new AuthorizationError("Access denied");
    }

    // If setting a householdId, verify user is a member of that household
    if (params.householdId) {
        if (!householdRepo.userIsMember(params.householdId, params.userId)) {
            throw new AuthorizationError(
                "You must be a member of the household to share the store with it"
            );
        }
    }

    return storeRepo.updateStoreHousehold({
        storeId: params.storeId,
        householdId: params.householdId,
        updatedById: params.userId,
    });
}

/**
 * Update a store's visibility (hide/show in dropdowns).
 * Requires access to the store.
 */
export function updateStoreVisibility(params: {
    storeId: string;
    isHidden: boolean;
    userId: string;
}): Store | null {
    const store = storeRepo.getStoreById(params.storeId);

    if (!store) {
        return null;
    }

    // Verify user has access to the store
    if (!storeRepo.userHasAccessToStore(params.userId, params.storeId)) {
        throw new AuthorizationError("Access denied");
    }

    return storeRepo.updateStoreVisibility({
        storeId: params.storeId,
        isHidden: params.isHidden,
        updatedById: params.userId,
    });
}
