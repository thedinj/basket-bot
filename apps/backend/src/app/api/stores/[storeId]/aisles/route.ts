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
        const aisles = storeEntityService.getAislesByStore(storeId, req.auth.sub);
        return NextResponse.json({ aisles });
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
        const name = typeof body.name === "string" ? body.name.trim() : body.name;

        if (!name || typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name is required" },
                { status: 400 }
            );
        }

        const aisle = storeEntityService.createAisle({ storeId, name, userId: req.auth.sub });
        return NextResponse.json({ aisle }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
