import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeService from "@/lib/services/storeService";
import { createStoreRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/stores
 * List all stores for the authenticated user
 */
async function handleGet(req: AuthenticatedRequest) {
    try {
        const stores = storeService.getStoresByUser(req.auth.sub);

        return NextResponse.json({ stores });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

/**
 * POST /api/stores
 * Create a new store (user becomes owner)
 */
async function handlePost(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const data = createStoreRequestSchema.parse(body);

        const store = storeService.createStore({
            name: data.name,
            userId: req.auth.sub,
        });

        return NextResponse.json({ store }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
