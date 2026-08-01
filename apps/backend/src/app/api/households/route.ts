import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as householdService from "@/lib/services/householdService";
import { createHouseholdRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/households
 * List all households the current user is a member of
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const households = householdService.getUserHouseholds(req.auth.sub);

        return NextResponse.json({ households }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});

/**
 * POST /api/households
 * Create a new household (user becomes owner)
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const body = await req.json();
        const { name } = createHouseholdRequestSchema.parse(body);

        const household = householdService.createHousehold(name, req.auth.sub);

        return NextResponse.json({ household }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
