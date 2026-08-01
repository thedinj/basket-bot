import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeService from "@/lib/services/storeService";
import { duplicateStoreRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * POST /api/stores/[storeId]/duplicate
 * Duplicate a store with its layout (aisles/sections) and optionally items
 */
async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();
        const data = duplicateStoreRequestSchema.parse(body);

        const store = storeService.duplicateStore({
            sourceStoreId: storeId,
            newStoreName: data.newStoreName,
            userId: req.auth.sub,
            includeItems: data.includeItems ?? false,
        });

        return NextResponse.json({ store }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);
