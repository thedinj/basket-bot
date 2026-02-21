import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeService from "@/lib/services/storeService";
import { updateStoreVisibilityRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/stores/[storeId]/visibility
 * Update a store's visibility (hide/show in dropdowns)
 */
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
    try {
        const storeId = context.params.storeId;
        const userId = req.auth.sub;

        const body = await req.json();
        const { isHidden } = updateStoreVisibilityRequestSchema.parse(body);

        const updatedStore = storeService.updateStoreVisibility({
            storeId,
            isHidden,
            userId,
        });

        if (!updatedStore) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Store not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(updatedStore, { status: 200 });
    } catch (error: any) {
        console.error("Error updating store visibility:", error);

        if (error.message?.includes("Access denied")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to update store visibility" },
            { status: 500 }
        );
    }
});
