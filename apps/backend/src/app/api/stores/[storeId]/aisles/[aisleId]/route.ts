import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, aisleId } = await params;
        const aisles = storeEntityService.getAislesByStore(storeId, req.auth.sub);
        const aisle = aisles.find((a) => a.id === aisleId) ?? null;

        if (!aisle) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Aisle not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ aisle });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, aisleId } = await params;
        const body = await req.json();
        const name = typeof body.name === "string" ? body.name.trim() : body.name;

        if (!name || typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name is required" },
                { status: 400 }
            );
        }

        const aisle = storeEntityService.updateAisle({
            id: aisleId,
            storeId,
            name,
            userId: req.auth.sub,
        });

        if (!aisle) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Aisle not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ aisle });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, aisleId } = await params;
        const body = await req.json();
        const { sortOrder } = body;

        if (typeof sortOrder !== "number") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "sortOrder is required and must be a number" },
                { status: 400 }
            );
        }

        const aisle = storeEntityService.updateAisleSortOrder({
            id: aisleId,
            storeId,
            sortOrder,
            userId: req.auth.sub,
        });

        if (!aisle) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Aisle not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ aisle });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, aisleId } = await params;
        storeEntityService.deleteAisle(aisleId, storeId, req.auth.sub);
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
