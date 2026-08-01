import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as invitationService from "@/lib/services/invitationService";
import { NextResponse } from "next/server";

/**
 * POST /api/invitations/[token]/accept
 * Accept a household invitation
 */
export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
    try {
        const { token } = await context.params;
        const userEmail = req.auth.email;

        if (!userEmail) {
            return NextResponse.json(
                { code: "BAD_REQUEST", message: "User email not found in token" },
                { status: 400 }
            );
        }

        invitationService.acceptInvitation(token, req.auth.sub, userEmail);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});
