import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
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
        const { storeId, aisleId } = await params;
        const body = await req.json();
        const { name } = body;

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
        const { storeId, aisleId } = await params;
        storeEntityService.deleteAisle(aisleId, storeId, req.auth.sub);
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
