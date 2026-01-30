import { withAuth, type AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeInvitationService from "@/lib/services/storeInvitationService";
import { NextResponse } from "next/server";

/**
 * DELETE /api/stores/invitations/[invitationId]
 * Retract (delete) a pending store invitation
 * Only the original inviter or store owner can retract
 */
export const DELETE = withAuth(
    async (req: AuthenticatedRequest, { params }: { params: Promise<Record<string, string>> }) => {
        try {
            const { invitationId } = await params;
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
    }
);
