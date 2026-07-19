import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const aisles = storeEntityService.getAislesByStore(storeId, req.auth.sub);
        return NextResponse.json({ aisles });
    } catch (error: any) {
        console.error("GET /api/stores/[storeId]/aisles error:", error);
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
        const name = typeof body.name === "string" ? body.name.trim() : body.name;

        if (!name || typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name is required" },
                { status: 400 }
            );
        }

        const aisle = storeEntityService.createAisle({ storeId, name, userId: req.auth.sub });
        return NextResponse.json({ aisle }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/stores/[storeId]/aisles error:", error);
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        if (error.message?.startsWith("AISLE_NAME_CONFLICT")) {
            return NextResponse.json(
                {
                    code: "AISLE_NAME_CONFLICT",
                    message: error.message.replace("AISLE_NAME_CONFLICT: ", ""),
                },
                { status: 409 }
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
