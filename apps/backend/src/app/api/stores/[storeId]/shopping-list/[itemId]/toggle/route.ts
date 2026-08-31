import { ValidationError } from "@basket-bot/core";
import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, itemId } = await params;
        const body = await req.json();
        const { isChecked } = body;

        if (typeof isChecked !== "boolean") {
            throw new ValidationError("isChecked (boolean) is required");
        }

        const result = storeEntityService.toggleShoppingListItemChecked(
            itemId,
            isChecked,
            storeId,
            req.auth.sub
        );
        return NextResponse.json({
            success: true,
            conflict: result.conflict,
            itemId: result.itemId,
            itemName: result.itemName,
            conflictUser: result.conflictUser,
        });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);
