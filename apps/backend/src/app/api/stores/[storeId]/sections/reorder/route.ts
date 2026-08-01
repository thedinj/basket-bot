import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();
        const { updates } = body;

        if (!Array.isArray(updates)) {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Updates must be an array" },
                { status: 400 }
            );
        }

        storeEntityService.reorderSections({ storeId, updates, userId: req.auth.sub });
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);
