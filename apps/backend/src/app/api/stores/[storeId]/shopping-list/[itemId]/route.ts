import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NotFoundError } from "@basket-bot/core";
import { NextResponse } from "next/server";

// DELETE removes item from shopping list only (use DELETE .../delete-with-item to also delete store item)
async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, itemId } = await params;
        storeEntityService.removeShoppingListItem(itemId, storeId, req.auth.sub);
        return NextResponse.json({ success: true });
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

export const DELETE = withAuth(handleDelete);
