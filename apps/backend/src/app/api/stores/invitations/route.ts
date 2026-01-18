import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeInvitationService from "@/lib/services/storeInvitationService";
import { NextResponse } from "next/server";

/**
 * GET /api/stores/invitations
 * Get pending store invitations for the current user
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

        const invitations = storeInvitationService.getUserPendingStoreInvitations(userEmail);

        return NextResponse.json({ invitations }, { status: 200 });
    } catch (error: any) {
        console.error("Error getting store invitations:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to get store invitations" },
            { status: 500 }
        );
    }
});
