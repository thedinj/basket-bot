import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NotFoundError } from "@basket-bot/core";
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
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "isChecked (boolean) is required" },
                { status: 400 }
            );
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
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return NextResponse.json(
                { code: "ITEM_NOT_FOUND", message: "Shopping list item not found" },
                { status: 404 }
            );
        }
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handlePost);
