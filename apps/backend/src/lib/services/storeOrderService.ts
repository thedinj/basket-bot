import { AuthorizationError } from "@basket-bot/core";
import * as storeRepo from "../repos/storeRepo";
import * as userStoreOrderRepo from "../repos/userStoreOrderRepo";

/**
 * Service layer for per-user store ordering.
 * Enforces that a user may only order stores they have access to.
 */

export function setStoreOrder(params: {
    userId: string;
    updates: Array<{ storeId: string; sortOrder: number }>;
}): void {
    for (const update of params.updates) {
        if (!storeRepo.userHasAccessToStore(params.userId, update.storeId)) {
            throw new AuthorizationError("Access denied");
        }
    }

    userStoreOrderRepo.setStoreOrder(params.userId, params.updates);
}
