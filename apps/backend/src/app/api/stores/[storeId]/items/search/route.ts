import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
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
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet);
