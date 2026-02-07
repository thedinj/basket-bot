import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeService from "@/lib/services/storeService";
import { updateStoreHouseholdRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/stores/[storeId]/household
 * Update a store's household association (share with household or make private)
 */
export const PATCH = withAuth(async (req: AuthenticatedRequest, context: any) => {
    try {
        const storeId = context.params.storeId;
        const userId = req.auth.sub;

        const body = await req.json();
        const { householdId } = updateStoreHouseholdRequestSchema.parse(body);

        const updatedStore = storeService.updateStoreHousehold({
            storeId,
            householdId,
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
        console.error("Error updating store household:", error);

        if (error.message?.includes("Access denied")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message },
                { status: 403 }
            );
        }

        if (error.message?.includes("must be a member")) {
            return NextResponse.json(
                { code: "BAD_REQUEST", message: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to update store household" },
            { status: 500 }
        );
    }
});
