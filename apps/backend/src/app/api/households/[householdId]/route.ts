import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as householdService from "@/lib/services/householdService";
import { updateHouseholdRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/households/[householdId]
 * Get household details with members
 */
export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const household = householdService.getHouseholdWithMembers(householdId, req.auth.sub);

        return NextResponse.json({ household }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});

/**
 * PUT /api/households/[householdId]
 * Update household name (requires membership)
 */
export const PUT = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const body = await req.json();
        const { name } = updateHouseholdRequestSchema.parse(body);

        if (!name) {
            return NextResponse.json(
                { code: "VALIDATION_ERROR", message: "Name is required" },
                { status: 400 }
            );
        }

        const household = householdService.updateHousehold(householdId, name, req.auth.sub);

        return NextResponse.json({ household }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});

/**
 * DELETE /api/households/[householdId]
 * Delete a household (requires membership)
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        householdService.deleteHousehold(householdId, req.auth.sub);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
