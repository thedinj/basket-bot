import type { Store } from "@basket-bot/core";
import * as storeRepo from "../repos/storeRepo";

/**
 * Service layer for Store operations.
 * Enforces business logic and authorization.
 */

export function createStore(params: { householdId: string; name: string; userId: string }): Store {
    // TODO: Verify user is a member of the household
    return storeRepo.createStore({
        householdId: params.householdId,
        name: params.name,
        createdById: params.userId,
    });
}

export function getStoresByHousehold(householdId: string, userId: string): Store[] {
    // TODO: Verify user is a member of the household
    return storeRepo.getStoresByHousehold(householdId);
}

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

export function deleteStore(id: string, userId: string): boolean {
    // Verify user has access
    if (!storeRepo.userHasAccessToStore(userId, id)) {
        throw new Error("Access denied");
    }

    return storeRepo.deleteStore(id);
}
