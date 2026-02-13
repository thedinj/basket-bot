import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
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
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Section not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ section });
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

async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, sectionId } = await params;
        const body = await req.json();
        const { name, aisleId } = body;

        // At least one field must be provided
        if (!name && !aisleId) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name or aisleId is required" },
                { status: 400 }
            );
        }

        if (name !== undefined && typeof name !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Name must be a string" },
                { status: 400 }
            );
        }

        if (aisleId !== undefined && typeof aisleId !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Aisle ID must be a string" },
                { status: 400 }
            );
        }

        const section = storeEntityService.updateSection({
            id: sectionId,
            storeId,
            name,
            aisleId,
            userId: req.auth.sub,
        });

        if (!section) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Section not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ section });
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

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, sectionId } = await params;
        const body = await req.json();
        const { aisleId, sortOrder } = body;

        if (typeof aisleId !== "string") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "aisleId is required and must be a string" },
                { status: 400 }
            );
        }

        if (typeof sortOrder !== "number") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "sortOrder is required and must be a number" },
                { status: 400 }
            );
        }

        const section = storeEntityService.updateSectionLocation({
            id: sectionId,
            storeId,
            aisleId,
            sortOrder,
            userId: req.auth.sub,
        });

        if (!section) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: "Section not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ section });
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

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId, sectionId } = await params;
        storeEntityService.deleteSection(sectionId, storeId, req.auth.sub);
        return NextResponse.json({ success: true });
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
export const PUT = withAuth(handlePut);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
