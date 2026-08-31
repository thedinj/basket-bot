import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeService from "@/lib/services/storeService";
import { NotFoundError, updateStoreHouseholdRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/stores/[storeId]/household
 * Update a store's household association (share with household or make private)
 */
async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const userId = req.auth.sub;

        const body = await req.json();
        const { householdId } = updateStoreHouseholdRequestSchema.parse(body);

        const updatedStore = storeService.updateStoreHousehold({
            storeId,
            householdId,
            userId,
        });

        if (!updatedStore) {
            throw new NotFoundError("Store not found");
        }

        return NextResponse.json(updatedStore, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const PATCH = withAuth(handlePatch);
