import type { Store } from "@basket-bot/core";
import { createDefaultStoreForUser } from "../db/seedDefaults";
import * as householdRepo from "../repos/householdRepo";
import * as storeRepo from "../repos/storeRepo";

/**
 * Service layer for Store operations.
 * Enforces business logic and authorization.
 */

/**
 * Create a new store. Creator has access automatically.
 * Store is private (householdId = null) by default.
 */
export function createStore(params: {
    name: string;
    userId: string;
    householdId?: string | null;
}): Store {
    return storeRepo.createStore({
        name: params.name,
        createdById: params.userId,
        householdId: params.householdId ?? null,
    });
}

/**
 * Create a default example store for a new user (used during registration)
 */
export function createDefaultStoreForNewUser(userId: string, userName: string): string {
    return createDefaultStoreForUser(userId, userName);
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
        throw new Error("Access denied");
    }

    return store;
}

/**
 * Update a store name (requires access)
 */
export function updateStore(params: { id: string; name: string; userId: string }): Store | null {
    // Verify user has access
    if (!storeRepo.userHasAccessToStore(params.userId, params.id)) {
        throw new Error("Access denied");
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
        throw new Error("Access denied");
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
        throw new Error("Access denied");
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
        throw new Error("Access denied");
    }

    // If setting a householdId, verify user is a member of that household
    if (params.householdId) {
        if (!householdRepo.userIsMember(params.householdId, params.userId)) {
            throw new Error("You must be a member of the household to share the store with it");
        }
    }

    return storeRepo.updateStoreHousehold({
        storeId: params.storeId,
        householdId: params.householdId,
        updatedById: params.userId,
    });
}
