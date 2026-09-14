import { deleteOrphanStoreItemsRequestSchema, ValidationError } from "@basket-bot/core";
import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const items = storeEntityService.getOrphanItems(storeId, req.auth.sub);

        return NextResponse.json({ items });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const parsed = deleteOrphanStoreItemsRequestSchema.safeParse(await req.json());

        if (!parsed.success) {
            throw new ValidationError(
                parsed.error.issues[0]?.message ?? "Invalid obliterate request"
            );
        }

        const { deletedCount, skippedCount } = storeEntityService.deleteOrphanItems(
            storeId,
            parsed.data.itemIds,
            req.auth.sub
        );

        return NextResponse.json({ success: true, deletedCount, skippedCount });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
