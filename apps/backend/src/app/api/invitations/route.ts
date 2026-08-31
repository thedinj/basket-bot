import { ValidationError } from "@basket-bot/core";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as invitationService from "@/lib/services/invitationService";
import { NextResponse } from "next/server";

/**
 * GET /api/invitations
 * Get pending invitations for the current user
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const userEmail = req.auth.email;
        if (!userEmail) {
            throw new ValidationError("User email not found in token");
        }

        const invitations = invitationService.getUserPendingInvitations(userEmail);

        return NextResponse.json({ invitations }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
