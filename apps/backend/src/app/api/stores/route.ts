import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeService from "@/lib/services/storeService";
import { createStoreRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/stores?householdId=xxx
 * List all stores for a household
 */
async function handleGet(req: AuthenticatedRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const householdId = searchParams.get("householdId");

        if (!householdId) {
            return NextResponse.json(
                { code: "MISSING_PARAMETER", message: "householdId is required" },
                { status: 400 }
            );
        }

        const stores = storeService.getStoresByHousehold(householdId, req.auth.sub);

        return NextResponse.json({ stores });
    } catch (error: any) {
        console.error("Get stores error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/stores
 * Create a new store
 */
async function handlePost(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const data = createStoreRequestSchema.parse(body);

        const store = storeService.createStore({
            householdId: data.householdId,
            name: data.name,
            userId: req.auth.sub,
        });

        return NextResponse.json({ store }, { status: 201 });
    } catch (error: any) {
        console.error("Create store error:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
