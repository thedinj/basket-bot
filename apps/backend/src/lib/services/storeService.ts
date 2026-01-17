import type { Store } from "@basket-bot/core";
import { createDefaultStoreForUser } from "../db/seedDefaults";
import * as storeRepo from "../repos/storeRepo";

/**
 * Service layer for Store operations.
 * Enforces business logic and authorization.
 */

/**
 * Create a new store. Automatically adds the creator as owner collaborator.
 */
export function createStore(params: { name: string; userId: string }): Store {
    const store = storeRepo.createStore({
        name: params.name,
        createdById: params.userId,
    });

    // Add creator as owner collaborator
    storeRepo.addStoreCollaborator({
        storeId: store.id,
        userId: params.userId,
        role: "owner",
    });

    return store;
}

/**
 * Create a default example store for a new user (used during registration)
 */
export function createDefaultStoreForNewUser(userId: string): string {
    return createDefaultStoreForUser(userId);
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
 * Update a store name (requires owner role)
 */
export function updateStore(params: { id: string; name: string; userId: string }): Store | null {
    // Verify user is owner
    if (!storeRepo.userIsStoreOwner(params.userId, params.id)) {
        throw new Error("Only store owners can update store details");
    }

    return storeRepo.updateStore({
        id: params.id,
        name: params.name,
        updatedById: params.userId,
    });
}

/**
 * Delete a store (requires owner role)
 */
export function deleteStore(id: string, userId: string): boolean {
    // Verify user is owner
    if (!storeRepo.userIsStoreOwner(userId, id)) {
        throw new Error("Only store owners can delete stores");
    }

    return storeRepo.deleteStore(id);
}
