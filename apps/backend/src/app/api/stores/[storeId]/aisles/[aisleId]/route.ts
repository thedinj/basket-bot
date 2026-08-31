import { NotFoundError, ValidationError } from "@basket-bot/core";
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
            throw new NotFoundError("Aisle not found");
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
            throw new ValidationError("Name is required");
        }

        const aisle = storeEntityService.updateAisle({
            id: aisleId,
            storeId,
            name,
            userId: req.auth.sub,
        });

        if (!aisle) {
            throw new NotFoundError("Aisle not found");
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
            throw new ValidationError("sortOrder is required and must be a number");
        }

        const aisle = storeEntityService.updateAisleSortOrder({
            id: aisleId,
            storeId,
            sortOrder,
            userId: req.auth.sub,
        });

        if (!aisle) {
            throw new NotFoundError("Aisle not found");
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
