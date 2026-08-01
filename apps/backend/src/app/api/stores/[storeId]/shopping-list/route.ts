import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { shoppingListItemInputSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const items = storeEntityService.getShoppingListItems(storeId, req.auth.sub);
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
        const body = await req.json();

        // Validate input with Zod schema
        const validatedInput = shoppingListItemInputSchema.parse({
            ...body,
            storeId,
        });

        const item = storeEntityService.upsertShoppingListItem({
            ...validatedInput,
            userId: req.auth.sub,
        });
        return NextResponse.json({ item }, { status: body.id ? 200 : 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
