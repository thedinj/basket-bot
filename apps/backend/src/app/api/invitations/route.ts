import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
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
            return NextResponse.json(
                { code: "BAD_REQUEST", message: "User email not found in token" },
                { status: 400 }
            );
        }

        const invitations = invitationService.getUserPendingInvitations(userEmail);

        return NextResponse.json({ invitations }, { status: 200 });
    } catch (error: any) {
        console.error("Error getting invitations:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to get invitations" },
            { status: 500 }
        );
    }
});
