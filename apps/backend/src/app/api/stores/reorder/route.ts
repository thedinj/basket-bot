import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
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
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);
