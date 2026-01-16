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
        const search = url.searchParams.get("q");

        if (search) {
            const limit = parseInt(url.searchParams.get("limit") || "20", 10);
            const items = storeEntityService.searchStoreItems(storeId, search, req.auth.sub, limit);
            return NextResponse.json({ items });
        }

        const items = storeEntityService.getItemsByStoreWithDetails(storeId, req.auth.sub);
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

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();
        const { name, aisleId, sectionId } = body;

        if (!name || typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name is required" },
                { status: 400 }
            );
        }

        const item = storeEntityService.createItem({
            storeId,
            name,
            aisleId: aisleId ?? null,
            sectionId: sectionId ?? null,
            userId: req.auth.sub,
        });
        return NextResponse.json({ item }, { status: 201 });
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
export const POST = withAuth(handlePost);
