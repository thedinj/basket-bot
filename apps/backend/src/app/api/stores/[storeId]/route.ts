import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeService from "@/lib/services/storeService";
import { NotFoundError, updateStoreRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/stores/[storeId]
 * Get a single store by ID
 */
async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const store = storeService.getStoreById(storeId, req.auth.sub);

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        return NextResponse.json({ store });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

/**
 * PUT /api/stores/[storeId]
 * Update a store
 */
async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();
        const data = updateStoreRequestSchema.parse(body);

        const store = storeService.updateStore({
            id: storeId,
            name: data.name,
            userId: req.auth.sub,
        });

        if (!store) {
            throw new NotFoundError("Store not found");
        }

        return NextResponse.json({ store });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

/**
 * DELETE /api/stores/[storeId]
 * Delete a store
 */
async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const success = storeService.deleteStore(storeId, req.auth.sub);

        if (!success) {
            throw new NotFoundError("Store not found");
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
