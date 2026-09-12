import { mergeStoreItemsRequestSchema, ValidationError } from "@basket-bot/core";
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
        const parsed = mergeStoreItemsRequestSchema.safeParse(await req.json());

        if (!parsed.success) {
            throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid merge request");
        }

        const item = storeEntityService.mergeItems({
            loserId: itemId,
            intoItemId: parsed.data.intoItemId,
            storeId,
            canonicalName: parsed.data.canonicalName,
            userId: req.auth.sub,
        });

        return NextResponse.json({ item });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);
