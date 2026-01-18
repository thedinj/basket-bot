import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeInvitationService from "@/lib/services/storeInvitationService";
import { NextResponse } from "next/server";

/**
 * POST /api/stores/invitations/[token]/decline
 * Decline a store invitation
 */
export const POST = withAuth(
    async (req: AuthenticatedRequest, { params }: { params: Promise<Record<string, string>> }) => {
        try {
            const { token } = await params;
            const userEmail = req.auth.email;

            if (!userEmail) {
                return NextResponse.json(
                    { code: "BAD_REQUEST", message: "User email not found in token" },
                    { status: 400 }
                );
            }

            storeInvitationService.declineStoreInvitation(token, userEmail);

            return NextResponse.json({ message: "Invitation declined" }, { status: 200 });
        } catch (error: any) {
            console.error("Error declining store invitation:", error);

            if (error.message.includes("NOT_FOUND")) {
                return NextResponse.json(
                    { code: "NOT_FOUND", message: "Invitation not found" },
                    { status: 404 }
                );
            }

            if (error.message.includes("FORBIDDEN")) {
                return NextResponse.json(
                    { code: "FORBIDDEN", message: "This invitation is not for your email" },
                    { status: 403 }
                );
            }

            if (error.message.includes("CONFLICT")) {
                return NextResponse.json(
                    { code: "CONFLICT", message: "Invitation has already been processed" },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { code: "INTERNAL_ERROR", message: "Failed to decline invitation" },
                { status: 500 }
            );
        }
    }
);
