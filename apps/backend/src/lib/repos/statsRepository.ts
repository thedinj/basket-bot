import { db } from "../db/db";

export interface SystemStats {
    userCount: number;
    storeCount: number;
    storeItemCount: number;
    shoppingListItemCount: number;
}

export const statsRepository = {
    /**
     * Get system-wide statistics
     */
    getSystemStats(): SystemStats {
        const userCount = db
            .prepare<[], { count: number }>(`SELECT COUNT(*) as count FROM "User"`)
            .get()!.count;

        const storeCount = db
            .prepare<[], { count: number }>(`SELECT COUNT(*) as count FROM "Store"`)
            .get()!.count;

        const storeItemCount = db
            .prepare<[], { count: number }>(`SELECT COUNT(*) as count FROM "StoreItem"`)
            .get()!.count;

        const shoppingListItemCount = db
            .prepare<[], { count: number }>(`SELECT COUNT(*) as count FROM "ShoppingListItem"`)
            .get()!.count;

        return {
            userCount,
            storeCount,
            storeItemCount,
            shoppingListItemCount,
        };
    },
};
