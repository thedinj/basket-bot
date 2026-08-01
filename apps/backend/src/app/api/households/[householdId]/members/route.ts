import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as householdService from "@/lib/services/householdService";
import * as invitationService from "@/lib/services/invitationService";
import { createInvitationRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

/**
 * GET /api/households/[householdId]/members
 * Get household members
 */
export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const members = householdService.getHouseholdMembers(householdId, req.auth.sub);

        return NextResponse.json({ members }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});

/**
 * POST /api/households/[householdId]/members
 * Create an invitation to join the household
 */
export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const body = await req.json();
        const { email } = createInvitationRequestSchema.parse(body);

        const invitation = invitationService.createInvitation(householdId, email, req.auth.sub);

        return NextResponse.json({ invitation }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
