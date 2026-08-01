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
        const sections = storeEntityService.getSectionsByStore(storeId, req.auth.sub);
        return NextResponse.json({ sections });
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
        const { aisleId } = body;
        const name = typeof body.name === "string" ? body.name.trim() : body.name;

        if (!name || typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name is required" },
                { status: 400 }
            );
        }

        if (!aisleId || typeof aisleId !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Aisle ID is required" },
                { status: 400 }
            );
        }

        const section = storeEntityService.createSection({
            storeId,
            aisleId,
            name,
            userId: req.auth.sub,
        });
        return NextResponse.json({ section }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
