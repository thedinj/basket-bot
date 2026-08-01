import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as invitationService from "@/lib/services/invitationService";
import { NextResponse } from "next/server";

/**
 * DELETE /api/households/[householdId]/invitations/[invitationId]
 * Cancel/retract a pending invitation (requires membership)
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { householdId, invitationId } = await context.params;
        invitationService.deleteInvitation(invitationId, householdId, req.auth.sub);

        return NextResponse.json({ message: "Invitation cancelled" }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
