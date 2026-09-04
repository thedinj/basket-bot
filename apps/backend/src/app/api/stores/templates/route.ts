import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeService from "@/lib/services/storeService";
import { NextResponse } from "next/server";

/**
 * GET /api/stores/templates
 * The starting layouts offered when creating a store.
 *
 * The catalog lives server-side, so a new template ships without a client release. A static
 * segment wins over the sibling `[storeId]` route, so this never resolves as a store id.
 */
async function handleGet(req: AuthenticatedRequest) {
    try {
        const templates = storeService.listStoreTemplates();

        return NextResponse.json({ templates });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
