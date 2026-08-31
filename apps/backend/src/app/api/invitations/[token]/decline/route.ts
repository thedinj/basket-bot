import { ValidationError } from "@basket-bot/core";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as invitationService from "@/lib/services/invitationService";
import { NextResponse } from "next/server";

/**
 * POST /api/invitations/[token]/decline
 * Decline a household invitation
 */
export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { token } = await context.params;
        const userEmail = req.auth.email;

        if (!userEmail) {
            throw new ValidationError("User email not found in token");
        }

        invitationService.declineInvitation(token, userEmail);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
