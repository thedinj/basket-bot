import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, itemId } = await params;
        const items = storeEntityService.getItemsByStore(storeId, req.auth.sub);
        const item = items.find((i) => i.id === itemId) ?? null;

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

async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, itemId } = await params;
        const body = await req.json();
        const { name, aisleId, sectionId } = body;

        if (!name || typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name is required" },
                { status: 400 }
            );
        }

        const item = storeEntityService.updateItem({
            id: itemId,
            storeId,
            name,
            aisleId: aisleId ?? null,
            sectionId: sectionId ?? null,
            userId: req.auth.sub,
        });

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

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, itemId } = await params;
        storeEntityService.deleteItem(itemId, storeId, req.auth.sub);
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
