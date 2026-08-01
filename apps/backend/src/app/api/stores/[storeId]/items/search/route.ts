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
        const q = url.searchParams.get("q");

        if (!q) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Search query 'q' is required" },
                { status: 400 }
            );
        }

        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        const items = storeEntityService.searchStoreItems(storeId, q, req.auth.sub, limit);

        return NextResponse.json({ items });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
