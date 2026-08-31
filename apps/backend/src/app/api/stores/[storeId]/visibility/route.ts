import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeService from "@/lib/services/storeService";
import { NotFoundError, updateStoreVisibilityRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * PATCH /api/stores/[storeId]/visibility
 * Update a store's visibility (hide/show in dropdowns)
 */
async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const userId = req.auth.sub;

        const body = await req.json();
        const { isHidden } = updateStoreVisibilityRequestSchema.parse(body);

        const updatedStore = storeService.updateStoreVisibility({
            storeId,
            isHidden,
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
