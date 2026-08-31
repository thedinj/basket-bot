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
        const { storeId, sectionId } = await params;
        const sections = storeEntityService.getSectionsByStore(storeId, req.auth.sub);
        const section = sections.find((s) => s.id === sectionId) ?? null;

        if (!section) {
            throw new NotFoundError("Section not found");
        }

        return NextResponse.json({ section });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, sectionId } = await params;
        const body = await req.json();
        const { aisleId } = body;
        const name = typeof body.name === "string" ? body.name.trim() : body.name;

        // At least one field must be provided
        if (!name && !aisleId) {
            throw new ValidationError("Name or aisleId is required");
        }

        if (name !== undefined && typeof name !== "string") {
            throw new ValidationError("Name must be a string");
        }

        if (aisleId !== undefined && typeof aisleId !== "string") {
            throw new ValidationError("Aisle ID must be a string");
        }

        const section = storeEntityService.updateSection({
            id: sectionId,
            storeId,
            name,
            aisleId,
            userId: req.auth.sub,
        });

        if (!section) {
            throw new NotFoundError("Section not found");
        }

        return NextResponse.json({ section });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, sectionId } = await params;
        const body = await req.json();
        const { aisleId, sortOrder } = body;

        if (typeof aisleId !== "string") {
            throw new ValidationError("aisleId is required and must be a string");
        }

        if (typeof sortOrder !== "number") {
            throw new ValidationError("sortOrder is required and must be a number");
        }

        const section = storeEntityService.updateSectionLocation({
            id: sectionId,
            storeId,
            aisleId,
            sortOrder,
            userId: req.auth.sub,
        });

        if (!section) {
            throw new NotFoundError("Section not found");
        }

        return NextResponse.json({ section });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, sectionId } = await params;
        storeEntityService.deleteSection(sectionId, storeId, req.auth.sub);
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
