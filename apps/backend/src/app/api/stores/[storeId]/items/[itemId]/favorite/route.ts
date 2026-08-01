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
        const item = storeEntityService.toggleItemFavorite(itemId, storeId, req.auth.sub);

        if (!item) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Item not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ item });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);
