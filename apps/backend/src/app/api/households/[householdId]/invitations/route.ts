import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as invitationService from "@/lib/services/invitationService";
import { NextResponse } from "next/server";

/**
 * GET /api/households/[householdId]/invitations
 * Get pending invitations for a household
 */
export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId } = await context.params;
        const invitations = invitationService.getHouseholdPendingInvitations(
            householdId,
            req.auth.sub
        );

        return NextResponse.json({ invitations }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
