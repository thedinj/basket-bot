import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeOrderService from "@/lib/services/storeOrderService";
import { reorderStoresRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handlePost(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const parsed = reorderStoresRequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Invalid reorder payload" },
                { status: 400 }
            );
        }

        storeOrderService.setStoreOrder({
            userId: req.auth.sub,
            updates: parsed.data.updates,
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("POST /api/stores/reorder error:", error);
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

export const POST = withAuth(handlePost);
