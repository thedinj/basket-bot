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
        const { name, aisleId, sortOrder } = body;

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

        const section = storeEntityService.updateSection({
            id: sectionId,
            storeId,
            name,
            aisleId,
            sortOrder: sortOrder ?? 0,
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
export const DELETE = withAuth(handleDelete);
