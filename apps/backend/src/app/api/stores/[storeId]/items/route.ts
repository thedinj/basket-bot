import { ValidationError } from "@basket-bot/core";
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
        const url = new URL(req.url);
        const search = url.searchParams.get("q");

        if (search) {
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const items = storeEntityService.searchStoreItems(storeId, search, req.auth.sub, limit);
            return NextResponse.json({ items });
        }

        const items = storeEntityService.getItemsByStoreWithDetails(storeId, req.auth.sub);
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
        const { name, aisleId, sectionId } = body;

        if (!name || typeof name !== "string") {
            throw new ValidationError("Name is required");
        }

        const item = storeEntityService.createItem({
            storeId,
            name,
            aisleId: aisleId ?? null,
            sectionId: sectionId ?? null,
            userId: req.auth.sub,
        });
        return NextResponse.json({ item }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
