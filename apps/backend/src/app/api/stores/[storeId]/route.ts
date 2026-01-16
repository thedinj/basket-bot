import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeService from "@/lib/services/storeService";
import { updateStoreRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/stores/[storeId]
 * Get a single store by ID
 */
async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const store = storeService.getStoreById(storeId, req.auth.sub);

        if (!store) {
            return NextResponse.json(
                { code: "STORE_NOT_FOUND", message: "Store not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ store });
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        console.error("Get store error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/stores/[storeId]
 * Update a store
 */
async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();
        const data = updateStoreRequestSchema.parse(body);

        const store = storeService.updateStore({
            id: storeId,
            name: data.name,
            userId: req.auth.sub,
        });

        if (!store) {
            return NextResponse.json(
                { code: "STORE_NOT_FOUND", message: "Store not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ store });
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        console.error("Update store error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/stores/[storeId]
 * Delete a store
 */
async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const success = storeService.deleteStore(storeId, req.auth.sub);

        if (!success) {
            return NextResponse.json(
                { code: "STORE_NOT_FOUND", message: "Store not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        console.error("Delete store error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
