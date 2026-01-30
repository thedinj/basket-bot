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

/**
 * DELETE /api/stores/invitations?id={invitationId}
 * Retract (delete) a pending store invitation
 * Only the original inviter or store owner can retract
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const invitationId = searchParams.get("id");

        if (!invitationId) {
            return NextResponse.json(
                { code: "BAD_REQUEST", message: "Invitation ID is required" },
                { status: 400 }
            );
        }

        const userId = req.auth.sub;

        storeInvitationService.retractStoreInvitation(invitationId, userId);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: unknown) {
        console.error("Error retracting store invitation:", error);

        if (error instanceof Error) {
            if (error.message.startsWith("NOT_FOUND:")) {
                return NextResponse.json(
                    { code: "NOT_FOUND", message: error.message.replace("NOT_FOUND: ", "") },
                    { status: 404 }
                );
            }
            if (error.message.startsWith("FORBIDDEN:")) {
                return NextResponse.json(
                    {
                        code: "FORBIDDEN",
                        message: error.message.replace("FORBIDDEN: ", ""),
                    },
                    { status: 403 }
                );
            }
            if (error.message.startsWith("CONFLICT:")) {
                return NextResponse.json(
                    { code: "CONFLICT", message: error.message.replace("CONFLICT: ", "") },
                    { status: 409 }
                );
            }
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to retract store invitation" },
            { status: 500 }
        );
    }
});
