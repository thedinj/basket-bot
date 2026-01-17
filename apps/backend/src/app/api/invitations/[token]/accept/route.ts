import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
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
    } catch (error: any) {
        console.error("Error accepting invitation:", error);

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

        if (error.message?.startsWith("CONFLICT")) {
            return NextResponse.json(
                { code: "CONFLICT", message: error.message.replace("CONFLICT: ", "") },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to accept invitation" },
            { status: 500 }
        );
    }
});
