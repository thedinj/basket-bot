import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
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
    } catch (error: any) {
        console.error("Error deleting invitation:", error);

        if (error.message?.startsWith("FORBIDDEN")) {
            return NextResponse.json(
                { code: "FORBIDDEN", message: error.message.replace("FORBIDDEN: ", "") },
                { status: 403 }
            );
        }

        if (error.message?.startsWith("NOT_FOUND")) {
            return NextResponse.json(
                { code: "NOT_FOUND", message: error.message.replace("NOT_FOUND: ", "") },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to cancel invitation" },
            { status: 500 }
        );
    }
});
