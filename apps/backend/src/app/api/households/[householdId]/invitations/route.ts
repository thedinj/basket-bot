import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
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
    } catch (error: any) {
        console.error("Error getting household invitations:", error);

        if (error.message?.startsWith("FORBIDDEN")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message.replace("FORBIDDEN: ", "") },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to get invitations" },
            { status: 500 }
        );
    }
});
